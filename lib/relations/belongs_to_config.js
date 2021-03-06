'use strict';

var _ = require('lodash');
var property = require('../util/property').fn;
var inflection = require('../util/inflection');
var Mixin = require('../util/mixin');

/**
 * HasMany mixin for options/configuration.
 *
 * This mixin separates some of the logic of {@link BelongsTo} and is only
 * intended to be mixed into that one class.
 */
module.exports = Mixin.create(/** @lends BelongsTo# */ {

  /**
   * Get the inverse of this relation. Access the option that was given or
   * calculate the value based on the current model class name.
   *
   * The resulting value will be locked in after the first call to avoid any
   * possible changes due to changing state outside of the relation.
   *
   * @private
   * @type {String}
   */
  inverse: property(function() {
    if (!this._inverse) {
      var inverse = _.camelCase(this._modelClass.__name__);
      this._inverse = this._options.inverse || inflection.pluralize(inverse);
    }
    return this._inverse;
  }),

  /**
   * Get the primary key for this relation. Access the option that was given or
   * simply use the value `id`.
   *
   * @private
   * @type {String}
   */
  primaryKey: property(function() {
    if (!this._primaryKey) {
      this._primaryKey = this._options.primaryKey || 'id';
    }
    return this._primaryKey;
  }),

  /**
   * Get the foreign key for this relation. Access the option that was given or
   * calculate the value based on the relation name.
   *
   * @private
   * @type {String}
   */
  foreignKey: property(function() {
    if (!this._foreignKey) {
      this._foreignKey = this._options.foreignKey ||
        _.snakeCase(this._name + '_id');
    }
    return this._foreignKey;
  }),

  /**
   * Get the foreign key property name for this relation, a camelized version
   * of {@link BelongsTo#foreignKey}.
   *
   * @private
   * @type {String}
   */
  foreignKeyProperty: property(function() {
    if (!this._foreignKeyProperty) {
      this._foreignKeyProperty = _.camelCase(this.foreignKey);
    }
    return this._foreignKeyProperty;
  }),

});
