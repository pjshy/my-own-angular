//scope events
//publish-subscribe messaging
describe('Events', function() {
  var parent
  var scope
  var child
  var isolatedChild

  beforeEach(function() {
    parent = new Scope()
    scope = parent.$new()
    child = scope.$new()
    isolatedChild = scope.$new(true)
  })

  it('allows registering listeners', function() {
    var listen1 = function() { }
    var listen2 = function() { }
    var listen3 = function() { }

    scope.$on('someEvent', listen1)
    scope.$on('someEvent', listen2)
    scope.$on('someOtherEvent', listen3)

    expect(scope.$$listeners).toEqual({
      someEvent: [listen1, listen2],
      someOtherEvent: [listen3]
    })
  })

  it('registers different listeners for every scope', function() {
    var listener1 = function() { }
    var listener2 = function() { }
    var listener3 = function() { }

    scope.$on('someEvent', listener1)
    child.$on('someEvent', listener2)
    isolatedChild.$on('someEvent', listener3)

    expect(scope.$$listeners).toEqual({someEvent: [listener1]})
    expect(child.$$listeners).toEqual({someEvent: [listener2]})
    expect(isolatedChild.$$listeners).toEqual({someEvent: [listener3]})
  })
})
