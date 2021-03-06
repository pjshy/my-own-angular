describe('scope', function() {
  it('can be constructed used as an object', function() {
    var scope = new Scope()
    scope.aProperty = 1

    expect(scope.aProperty).toBe(1)
  })

//scope dirty-checking
  describe('digest', function() {
  	var scope

  	beforeEach(function() {
  		scope = new Scope()
  	})

  	it('calls the listener function when the watched value changes', function() {
  		var watchFn = jasmine.createSpy()
  		var listenerFn = function() { }
  		scope.$watch(watchFn, listenerFn)

  		scope.$digest()

  		expect(watchFn).toHaveBeenCalledWith(scope)
  	})

  	it('calls listener when watch value is first undefined', function() {
  		scope.counter = 0

  		scope.$watch(
  			function(scope) {return scope.someValue},
  			function(newValue, oldValue, scope) {scope.counter++}
  		)

  		scope.$digest()
  		expect(scope.counter).toBe(1)
  	})

  	it('calls listener with new value as old value the first time', function() {
  		scope.someValue = 123
  		var oldValueGiven

  		scope.$watch(function(scope) {
  			return scope.someValue
  		},function(newValue, oldValue, scope) {
  			oldValueGiven = oldValue
  		})

  		scope.$digest()
  		expect(oldValueGiven).toBe(123)
  	})

    it('may have watchers that omit the listener function', function() {
      var watchFn = jasmine.createSpy().and.returnValue('something')

      scope.$watch(watchFn)
      scope.$digest()

      expect(watchFn).toHaveBeenCalled()
    })

		it('triggers chaine watchers in the same digest', function() {
			scope.name = 'jane'

			scope.$watch(
				function(scope) {return scope.nameUpper},
				function(newValue, oldValue, scope) {
					if(newValue) {
						scope.initial = newValue.substring(0, 1) + '.'
					}
				}
			)

			scope.$watch(
				function(scope) {return scope.name},
				function(newValue, oldValue, scope) {
					if(newValue) {
						scope.nameUpper = newValue.toUpperCase()
					}
				}
			)

			scope.$digest()
			expect(scope.initial).toBe('J.')

			scope.name = 'bob'
			scope.$digest()
			expect(scope.initial).toBe('B.')
		})

		it('gives up on the watches after 10 iterations', function() {
			scope.counterA = 0
			scope.counterB = 0

			scope.$watch(
				function(scope) {return scope.counterA},
				function(newValue, oldValue, scope) {
					scope.counterB++
				}
			)

			scope.$watch(
				function(scope) {return scope.counterB},
				function(newValue, oldValue, scope) {
					scope.counterA++
				}
			)

			//it will call that function for us, so that it can check that it throws an exception like we expect
			expect((function() { scope.$digest()})).toThrow()
		})

		it('ends the digest when the last watch is clean', function() {
			scope.array = _.range(100)
			//console.log(scope.array)
			var watchExecutions = 0

			_.times(100, function(i) {
				scope.$watch(
					function(scope) {
						watchExecutions++
						return scope.array[i]
					},
					function(newValue, oldValueGiven, scope) {

					}
				)
			})

			scope.$digest()
			expect(watchExecutions).toBe(200)

			scope.array[0] = 420
			scope.$digest()
			expect(watchExecutions).toBe(301)
		})

		it('does not end digest so that new watchers are not run', function() {
			scope.aValue = 'abc'
			scope.count = 0

			scope.$watch(
				function(scope) {
					return scope.aValue
				}, function(newValue, oldValue, scope) {
					scope.$watch(
						function(scope) {
							return scope.aValue
						}, function(newValue, oldValue, scope) {
							scope.count++
						})
				})
			scope.$digest()

			expect(scope.count).toBe(1)
		})

		it('compare based on value if enabled', function() {
			scope.aValue = [1, 2, 3]
			scope.count = 0

			scope.$watch(
				function(scope) {
					return scope.aValue
				}, function(newValue, oldValue, scope) {
					scope.count++
				},
				true)

			scope.$digest()
			expect(scope.count).toBe(1)

			scope.aValue.push(4)
			scope.$digest()
			expect(scope.count).toBe(2)
		})

		it('correctly handles NaNs', function() {
			scope.number = 0/0
			scope.counter = 0

			scope.$watch(
				function(scope) {return scope.number},
				function(newValue, oldValue, scope) {
					scope.counter++
				})

			scope.$digest()
			expect(scope.counter).toBe(1)

			scope.$digest()
			expect(scope.counter).toBe(1)
		})

		it('executes $eval ed function and returns result', function() {
			scope.aValue = 42

			var result = scope.$eval(function(scope) {
				return scope.aValue
			})

			expect(result).toBe(42)
		})

		it('passes the second $eval arguments straight through', function() {
			scope.aValue = 42

			var result = scope.$eval(function(scope, arg) {
				return scope.aValue + arg
			}, 2)

			expect(result).toBe(44)
		})

		it('executes $apply ed function and starts the digest', function() {
			scope.aValue = 'someValue'
			scope.counter = 0

			scope.$watch(
				function(scope) {return scope.aValue},
				function(newValue, oldValue, scope) {
					scope.counter++
				})

			scope.$digest()
			expect(scope.counter).toBe(1)

			scope.$apply(function(scope) {
				scope.aValue = 'someOtherValue'
			})
			expect(scope.counter).toBe(2)
		})

		it('executes $evalAsync function later in the same cycle', function() {
			scope.aValue = [1, 2, 3]
			scope.asyncEvaluated = false
			scope.asyncEvaluatedImmediately = false

			scope.$watch(
				function(scope) {return scope.aValue},
				function(newValue, oldValue, scope) {
					scope.$evalAsync(function(scope) {
						scope.asyncEvaluated = true
					})
				  	scope.asyncEvaluatedImmediately = scope.asyncEvaluated
				}
			)

			scope.$digest()
			expect(scope.asyncEvaluated).toBe(true)
			expect(scope.asyncEvaluatedImmediately).toBe(false)
		})

		it('executes $evalAsync functions even when not dirty', function() {
			scope.aValue = [1, 2, 3]
			scope.asyncEvaluatedTimes = 0

			scope.$watch(
				function(scope) {
					if(scope.asyncEvaluatedTimes < 2) {
						scope.$evalAsync(function() {
							scope.asyncEvaluatedTimes++
						})
					}
					return scope.aValue
				},
				function(newValue, oldValue, scope) {}
			)

			scope.$digest()

			expect(scope.asyncEvaluatedTimes).toBe(2)
		})

		it('eventually hats $evalAsyncs added by watches', function() {
			scope.aValue = [1, 2, 3]

			scope.$watch(
				function(scope) {
					scope.$evalAsync(function(scope) {})
					return scope.aValue
				},
				function(newValue, oldValue, scope) {}
			)

			expect((function() {scope.$digest()})).toThrow()
		})

		it('has a $$Phase field whose value is current digest phase', function() {
			scope.aValue = [1, 2, 3]
			scope.phaseInWatchFunction = undefined
			scope.phaseInListenerFunction = undefined
			scope.phaseInApplyFunction = undefined

			scope.$watch(
				function(scope) {
					scope.phaseInWatchFunction = scope.$$phase
					return scope.aValue
				},
				function(newValue, oldValue, scope) {
					scope.phaseInListenerFunction = scope.$$phase
				}
			)

			scope.$apply(function(scope) {
				scope.phaseInApplyFunction = scope.$$phase
			})

			expect(scope.phaseInWatchFunction).toBe('$digest')
			expect(scope.phaseInListenerFunction).toBe('$digest')
			expect(scope.phaseInApplyFunction).toBe('$apply')
		})

		it('schedules a digest in $evalAsync', function(done) {
			scope.aValue = 'abc'
			scope.counter = 0

			scope.$watch(
				function(scope) {return scope.aValue},
				function(newValue, oldValue, scope) {
					scope.counter++
				}
			)

			scope.$evalAsync(function(scope) {})

			expect(scope.counter).toBe(0)
			setTimeout(function() {
				expect(scope.counter).toBe(1)
        done()
			}, 50)
		})

		it('allows async $apply with $applyAsync', function(done) {
			scope.counter = 0

			scope.$watch(
				function(scope) {return scope.aValue},
				function(newValue, oldValue,scope) {
					scope.counter++
				}
			)

			scope.$digest()
			expect(scope.counter).toBe(1)

			scope.$applyAsync(function(scope) {
				scope.counter++
			})
			expect(scope.counter).toBe(1)

			setTimeout(function() {
				expect(scope.counter).toBe(2)
        done()
			}, 50)
		})

		it('never executes $applyAsync ed function in the same cycle', function(done) {
			scope.aValue = [1, 2, 3]
			scope.asyncApplied = false

			scope.$watch(
        function(scope) {return scope.aValue},
        function(newValue, oldValue, scope) {
          scope.$applyAsync(function(scope) {
          	scope.asyncApplied = true
          })
        }
      )

      scope.$digest()
      expect(scope.asyncApplied).toBe(false)
      setTimeout(function() {
      	expect(scope.asyncApplied).toBe(true)
        done()
      }, 50)
		})

		it('coalesces many calls to $applyAsync', function(done) {
			scope.counter = 0

			scope.$watch(
				function(scope) {
					scope.counter++
					return scope.aValue
				},
				function(newValue, oldValue, scope) {}
			)

			scope.$applyAsync(function(scope) {
				scope.aValue = 'abc'
			})
			scope.$applyAsync(function(scope) {
				scope.aValue = 'def'
			})

			setTimeout(function() {
				expect(scope.counter).toBe(2)
        done()
			}, 50)
		})

    it('runs a $$postDigest function after each digest', function() {
      scope.counter = 0

      scope.$$postDigest(function() {
        scope.counter++
      })

      expect(scope.counter).toBe(0)

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('does not include $$postDigest in the digest', function() {
      scope.aValue = 'origin value'

      scope.$$postDigest(function() {
        scope.aValue = 'changed value'
      })

      scope.$watch(
        function(scope) { return scope.aValue },
        function(newValue, oldValue, scope) {
          scope.watchValue = newValue
        }
      )

      scope.$digest()
      expect(scope.watchValue).toBe('origin value')

      scope.$digest()
      expect(scope.watchValue).toBe('changed value')
    })

    it('allows destroying a $watch with a removal function', function() {
      scope.aValue = 'abc'
      scope.counter = 0

      var destroyWatch = scope.$watch(
        function(scope) { return scope.aValue },
        function(newValue, oldValue, scope) {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)

      scope.aValue = 'def'
      scope.$digest()
      expect(scope.counter).toBe(2)

      scope.aValue = 'ghi'
      destroyWatch()
      scope.$digest()
      expect(scope.counter).toBe(2)
    })

    it('allows destroying a $watch during digest', function() {
      scope.aValue = 'abc'

      var watchCalls = []

      scope.$watch(
        function(scope) {
          watchCalls.push('first')
          return scope.aValue
        }
      )

      var destroyWatch = scope.$watch(
        function(scope) {
          watchCalls.push('second')
          destroyWatch()
        }
      )

      scope.$watch(
        function(scope) {
          watchCalls.push('third')
          return scope.aValue
        }
      )

      scope.$digest()
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third'])
    })

    it('allows a $watch to destroy another during digest', function() {
      scope.aValue = 'abc'
      scope.counter = 0

      scope.$watch(
        function(scope) {
          return scope.aValue
        },
        function(newValue, oldvalue, scope) {
          destroyWatch()
        }
      )

      var destroyWatch = scope.$watch(
        function(scope) { },
        function(newValue, oldValue, scope) { }
      )

      scope.$watch(
        function(scope) {
          return scope.aValue
        },
        function(newValue, oldValue, scope) {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(1)
    })

    it('allows destroying serveral $watches during digest', function() {
      scope.aValue = 'abc'
      scope.counter = 0

      var destroyWatch1 = scope.$watch(
        function(scope) {
          destroyWatch1()
          destroyWatch2()
        }
      )
      var destroyWatch2 = scope.$watch(
        function(scope) { return scope.aValue },
        function(newValue, oldValue, scope) {
          scope.counter++
        }
      )

      scope.$digest()
      expect(scope.counter).toBe(0)
    })

    describe('$watchGroup', function() {
      var scope
      beforeEach(function() {
        scope = new Scope()
      })

      it('takes watches as an array and calls listener with arrays', function() {
        var gotNewValues, gotOldValue

        scope.aValue = 1
        scope.anotherValue = 2

        scope.$watchGroup([
          function(scope) { return scope.aValue },
          function(scope) { return scope.anotherValue }
        ], function(newValue, oldvalue, scope) {
          gotNewValues = newValue
          gotOldValue = oldvalue
        })
        scope.$digest()

        expect(gotNewValues).toEqual([1, 2])
        expect(gotOldValue).toEqual([1, 2])
      })

      it('only calls listener once per digest', function() {
        var counter = 0

        scope.aValue = 1
        scope.anotherValue = 2

        scope.$watchGroup([
          function(scope) { return scope.aValue },
          function(scope) { return scope.anotherValue }
        ], function(newValues, oldValues, scope) {
          counter++
        })
        scope.$digest()

        expect(counter).toBe(1)
      })
    })
  })
})
