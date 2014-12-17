'use strict';

var _ = require('lodash');
var Mixin = require('../util/mixin');

/**
 * ModelQuery mixin for introspection & transformation of field strings.
 *
 * This mixin relies on external functionality:
 *
 *   - It relies on methods from the ModelQuery Helpers mixin. Reference that
 *     mixin for code & documentation.
 *
 * This mixin separates some of the logic of {@link ModelQuery} and is only
 * intended to be mixed into that one class.
 */
module.exports = Mixin.create(/** @lends ModelQuery# */ {

  /**
   * Override of {@link BaseQuery#_create}.
   *
   * @method
   * @private
   * @see {@link BaseQuery#_create}
   */
  _create: function() {
    this._super.apply(this, arguments);
    this._joinedRelations = {};
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
    this._joinedRelations = _.clone(orig._joinedRelations);
  },

  /**
   * Override of {@link Join#join}. Handles joins that specify a model with
   * which to join. If this does not appear to be a join for a model, then the
   * standard {@link Join#join} will be called.
   *
   * In the case where you're using trying to use a table name, but it is also
   * the name of an association on your model, this method will recognize that
   * you've passed multiple arguments (as required by {@link Join#join}) and
   * will not use the association.
   *
   * @method
   * @public
   * @param {String} association The name of the relation to join.
   * @see {@link Join#join}
   */
  join: function(/*association*/) {
    return arguments.length === 1 ?
      this._joinAssociation(arguments[0]) :
      this._super.apply(this, arguments);
  },

  /**
   * Join a specific association.
   *
   * @param {String} association Relation key path.
   * @return {ChainedQuery} The newly configured query.
   */
  _joinAssociation: function(association) {
    // iterate the association, keeping track of the previous association that
    // was used, so that each join can build off of the previous. the `through`
    // variable is keeping track of the previous association while the `dup` is
    // building up the full join for this association string.
    var through;
    var dup = this._dup();

    this._associationForEach(association, function(assoc) {
      dup = dup._joinRelation(assoc, through,
        this._lookupRelation(assoc, 'join'));
      through = assoc;
    }, this);

    return dup;
  },

  /**
   * Whether the table name is currently used in this query.
   *
   * @method
   * @private
   * @param {String} name The name to check.
   * @return {Boolean}
   */
  _tableInQuery: function(name) {
    var result = false;
    result = result || (name === this._model.tableName);
    result = result || _.any(this._joinedRelations, function(joinDetails) {
      return joinDetails.as === name;
    });
    return result;
  },

  /**
   * Generate a unique table alias name.
   *
   * @param {String} name The base table name.
   * @return {String} The unique name.
   * @see {@link ModeQuery#_tableInQuery}
   */
  _uniqueTableAlias: function(name) {
    var alias = name;
    var n = 1;
    while (this._tableInQuery(alias)) {
      alias = name + '_j' + n;
      n+= 1;
    }
    return alias;
  },

  /**
   * Join a specific relation using a specific name.
   *
   * @param {String} name The name by which this association is referred.
   * Usually this will be an association string (a relation key path), but will
   * sometimes may be generated to avoid name conflicts.
   * @param {Relation} relation The relation to join.
   * @return {ChainedQuery} The newly configured query.
   */
  _joinRelation: function(name, through, relation) {
    var baseTable = relation.modelClass.tableName;
    var joinTable = relation.relatedModelClass.tableName;
    var joinArg = joinTable; // the table name (or table/alias object)

    // change the base table name if this is through an existing join
    var throughJoinDetails = through && this._joinedRelations[through];
    if (throughJoinDetails) {
      baseTable = throughJoinDetails.as;
    }

    // create an alias for the join if the table's already used in the query
    if (this._tableInQuery(joinTable)) {
      var alias = this._uniqueTableAlias(relation._name);
      joinArg = _.object([[joinTable, alias]]);
      joinTable = alias;
    }

    // create the condition & the new query
    var condition = relation.joinCondition(baseTable, joinTable);
    var dup = this.join(joinArg, 'inner', condition);
    dup._joinedRelations[name] = {
      as: joinTable,
      relation: relation
    };
    return dup;
  },

});