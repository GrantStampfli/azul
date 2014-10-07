'use strict';

var expect = require('chai').expect;
var Class = require('../../lib/util/class');

describe('Class', function() {

  it('is an object', function() {
    expect(Class).to.be.instanceOf(Object);
  });

  it('is a function', function() {
    expect(Class).to.be.instanceOf(Function);
  });

  it('can be instantiated without being extended', function() {
    expect(Class.create()).to.exist;
  });

  it('creates classes that are themselves functions', function() {
    expect(Class.extend()).to.be.instanceOf(Function);
  });

  it('can be extended 1 time', function() {
    var Animal = Class.extend();
    var animal = Animal.create();
    expect(animal).to.be.instanceOf(Animal.__class__);
    expect(animal).to.be.instanceOf(Class.__class__);
  });

  it('can be extended 2 times', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend();
    var dog = Dog.create();
    expect(dog).to.be.instanceOf(Dog.__class__);
    expect(dog).to.be.instanceOf(Animal.__class__);
    expect(dog).to.be.instanceOf(Class.__class__);
  });

  it('can be extended 3 times', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend();
    var Havanese = Dog.extend();
    var milo = Havanese.create();
    expect(milo).to.be.instanceOf(Havanese.__class__);
    expect(milo).to.be.instanceOf(Dog.__class__);
    expect(milo).to.be.instanceOf(Animal.__class__);
    expect(milo).to.be.instanceOf(Class.__class__);
  });

  it('can specify methods', function() {
    var Animal = Class.extend({
      speak: function() { return 'hi'; }
    });
    expect(Animal.create().speak()).to.eql('hi');
  });

  it('can specify an init method', function() {
    var Subclass = Class.extend({
      init: function() { this.initialized = true; }
    });
    var obj = Subclass.create();
    expect(obj.initialized).to.be.true;
  });

  it('calls init methods in proper sequence', function() {
    var sequence = 0;
    var Animal = Class.extend({
      init: function() { this.animal = sequence++; }
    });
    var Dog = Animal.extend({
      init: function() { this.dog = sequence++; }
    });
    var dog = Dog.create();
    expect(dog.animal).to.eql(0);
    expect(dog.dog).to.eql(1);
  });

  it('allows static methods to be accessed via sublcasses', function() {
    var Animal = Class.extend();
    var staticMember = {};
    Animal.reopenClass({
      staticMember: staticMember
    });
    expect(Animal.staticMember).to.eql(staticMember);
  });

  it('allows static methods to be accessed via sublcasses', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend();
    var staticMember = {};
    Animal.reopenClass({ staticMember: staticMember });
    expect(Dog.staticMember).to.eql(staticMember);
    expect(Animal.staticMember).to.eql(staticMember);
  });

  it('creates instances that know their identity (class)', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend({});
    var dog = Dog.create();
    expect(dog.__identity__).to.eql(Dog);
  });

  it('creates instances that are an instance of its class', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend({});
    var dog = Dog.create();
    expect(dog).to.be.an.instanceOf(Dog.__class__);
  });

  it('creates instances that know their metaclass', function() {
    // this will likely never be useful for external use, but is important
    // internally.
    var Animal = Class.extend();
    var Dog = Animal.extend({});
    var dog = Dog.create();
    expect(dog.__metaclass__).to.eql(Dog.__metaclass__);
  });

  it('knows its identity (class)', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend({});
    expect(Dog.__identity__).to.eql(Dog);
  });

  it('creates valid metaclass prototype chain', function() {
    // this will likely never be useful for external use, but is important
    // internally.
    var Animal = Class.extend({}, { __name__: 'Animal' });
    var Dog = Animal.extend({}, { __name__: 'Dog' });
    expect(Dog.__metaclass__.prototype).to.be.instanceOf(Animal.__metaclass__);
    expect(Dog.__metaclass__.prototype).to.be.instanceOf(Class.__metaclass__);
  });

  it('has descriptive instances', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend({}, {
      __name__: 'Dog'
    });
    var dog = Dog.create();
    expect(dog.inspect()).to.eql('[Dog]');
    expect(dog.toString()).to.eql('[Dog]');
  });

  it('has descriptive classes', function() {
    var Animal = Class.extend();
    var Dog = Animal.extend({}, {
      __name__: 'Dog'
    });
    expect(Dog.inspect()).to.eql('[Dog Class]');
    expect(Dog.toString()).to.eql('[Dog Class]');
  });
});