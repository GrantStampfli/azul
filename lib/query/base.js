'use strict';

var _ = require('lodash');
var BluebirdPromise = require('bluebird');
var Class = require('../util/class');
var Transaction = require('./mixins/transaction');
var Transform = require('./mixins/transform');
var EventEmitter = require('events').EventEmitter;
var property = require('../util/property').fn;

/**
 * An indication that this is a new query that matches the specific type of
 * query that this was chained from. This is used throughout the documentation
 * as a return value when the specific type of query that is returned is not
 * able to be specified (for instance, in mixins).
 *
 * @typedef {BaseQuery} ChainedQuery
 */

/**
 * Queries are the building block of Azul's database abstraction layer. They
 * are immutable, chainable objects. Each operation that you perform on a query
 * will return a duplicated query rather than the original. The duplicated
 * query will be configured as requested.
 *
 * Generally, you will not create queries directly. Instead, you will receive
 * a query object via one of many convenience methods.
 *
 * @protected
 * @constructor BaseQuery
 * @mixes Transaction
 * @mixes Transform
 * @param {Adapter} adapter The adapter to use when using the query.
 */
var BaseQuery = Class.extend(/** @lends BaseQuery# */ {
  init: function(adapter) {
    this._super();
    this._adapter = adapter;
    this._executed = false;
    this._promise = new BluebirdPromise(function(resolve, reject) {
      this._resolve = resolve;
      this._reject = reject;
    }.bind(this));
  },

  /**
   * Construct a new specific type of query and pass off arguments to the
   * `_create` method of that query.
   *
   * This method does a bit of work to try to ensure that the newly created
   * query is set up properly. It first creates a new instance of the given
   * type. Then it determines any mixins that the new type uses that the old
   * type did not & calls the `init` function on each of those. It then
   * performs a `_take` to copy anything from the existing query to the spawned
   * version. Finally, the new object's `_create` method is called to complete
   * the spawn.
   *
   * The `_take` implementation is that of the original object & not of the
   * spawned object, so some extra properties may end up on the resulting
   * object that do not apply to it.
   *
   * Note that during the process of calling mixin `init` methods, the method
   * is intentionally called in a way where `_super` calls will have no effect.
   * It will simply perform the initialization for that individual mixin.
   *
   * @method
   * @private
   * @param {Class} type The query type to use.
   * @param {Arguments} args The arguments to pass off.
   * @return {ChainedQuery} A new query of the given type.
   */
  _spawn: function(type, args) {
    var currentMixins = this.__identity__.__mixins__;
    var newMixins = _.difference(type.__mixins__, currentMixins);
    var query = type.new();
    newMixins.forEach(function(mixin) {
      if (mixin.hasOwnProperty('init')) {
        mixin.init.call(query);
      }
    });
    this.__class__.prototype._take.call(query, this);
    type.__class__.prototype._create.apply(query, args);

    this.emit('spawn', query);

    return query;
  },

  /**
   * Override point for initializing spawned queries.
   *
   * @method
   * @private
   */
  _create: function() {},

  /**
   * This method duplicates a query. Queries are immutable objects. All query
   * methods should return copies of the query rather than mutating any internal
   * state.
   *
   * This method is implemented by subclasses to complete duplication of an
   * object. Be sure to call `_super()`. Subclasses should duplicate and
   * reassign all properties that are considered mutable.
   *
   * @method
   * @protected
   * @return {BaseQuery} The duplicated query.
   */
  _dup: function() {
    var dup = this.__identity__.new();
    dup._take(this);

    this.emit('dup', dup);

    return dup;
  },

  /**
   * Duplication implementation.
   *
   * @method
   * @protected
   * @see {@link BaseQuery#_take}
   */
  _take: function(orig) {
    this._super(orig);
    this._adapter = orig._adapter;
    this._executed = false;
    this._promise = new BluebirdPromise(function(resolve, reject) {
      this._resolve = resolve;
      this._reject = reject;
    }.bind(this));
  },

  /**
   * Clone a query.
   *
   * In most cases, you will want to take advantage of the fact that queries
   * cache their results. In some cases, however, you may want to re-execute
   * the exact same query. You can clone the query and use
   * {@link BaseQuery#then} or {@link BaseQuery#execute} to re-execute the
   * query:
   *
   *     query.clone().then(\/*...*\/);
   *
   * @return {BaseQuery} The duplicated query.
   */
  clone: function() {
    return this._dup();
  },

  /**
   * Get the statement (SQL & args) for a query.
   *
   * This method simply returns the statement for the query, but can be
   * overridden in sub-classes to provide a statement that is customized on a
   * per-adapter basis when possible.
   *
   * @public
   * @type {Statement}
   * @readonly
   */
  statement: property(function() {
    return this._statement();
  }),

  /**
   * Override point for statement generation.
   *
   * @method
   * @protected
   * @see {@link BaseQuery#statement}
   */
  _statement: function() {
    throw new Error('BaseQuery cannot be used directly.');
  },

  /**
   * The SQL of the query's statement. A shortcut for `statement.sql`.
   *
   * @public
   * @type {String}
   * @readonly
   * @see {@link BaseQuery#statement}
   */
  sql: property(function() {
    return this.statement.sql;
  }),

  /**
   * The args of the query's statement. A shortcut for `statement.args`.
   *
   * @public
   * @type {Array}
   * @readonly
   * @see {@link BaseQuery#statement}
   */
  args: property(function() {
    return this.statement.args;
  }),

  /**
   * Override point for query execution.
   *
   * If a subclass changes the resolved value here, it will change the
   * query's final result as well. The values emitted & cached will be taken
   * from the override.
   *
   * @method
   * @public
   * @return {Promise}
   */
  _execute: function() {
    var self = this;
    var statement = this.statement;
    var adapterExecute = function() {
      return self._adapter.execute(statement.sql, statement.args, {
        client: self.client()
      });
    };
    return BluebirdPromise.bind()
      .tap(this.emit.bind(this, 'execute'))
      .then(adapterExecute)
      .tap(this.emit.bind(this, 'rawResult'));
  },

  /**
   * Execute the query.
   *
   * @return {Promise} A promise that will resolve when execution is complete.
   */
  execute: BluebirdPromise.method(function() {
    if (!this._executed) {
      var self = this;
      this._executed = true;
      this._execute()
      .tap(function(result) { self.emit('result', result); })
      .catch(function(e) { self.emit('error', e); throw e; })
      .then(this._resolve, this._reject);
    }
    return this._promise;
  }),

  /**
   * {@link BaseQuery} is a _thenable_ object.
   *
   * @param {Function} fulfilledHandler
   * @param {Function} rejectedHandler
   * @return {Promise}
   */
  then: function(fulfilledHandler, rejectedHandler) {
    return this.execute().then(fulfilledHandler, rejectedHandler);
  }
});

BaseQuery.reopen(Transaction); // transaction methods override base query methods
BaseQuery.reopen(Transform); // transform methods override base query methods

BaseQuery.reopen(EventEmitter.prototype);

module.exports = BaseQuery.reopenClass({ __name__: 'BaseQuery' });
