//set the default value of watch.last and make it unqiue
//we would rather not leak that function outside of scope
const initWatchVal = () => {}

class Scope {
	constructor() {
		this.$$watchers = []
		this.$$asyncQueue = []
		this.$$applyAsyncQueue = []
		this.$$postDigestQueue = []
		this.$$children = []
		this.$root = this
		this.$$lastDirtyWatch = null
		this.$$applyAsyncId = null
		this.$$phase = null
		this.$$listeners = {}
	}

	$watch(watchFn, listenerFn, valueEq) {
		let self = this
		let watcher = {
			watchFn: watchFn,
			listenerFn: listenerFn || function() {},
			valueEq: !!valueEq,
			last: initWatchVal
		}
		this.$$watchers.unshift(watcher)
		//does not end the digest so that the new watches are not run
		this.$root.$$lastDirtyWatch = null

		return function() {
			let index = self.$$watchers.indexOf(watcher)
			if(index >= 0) {
				self.$$watchers.splice(index, 1)
				self.$root.$$lastDirtyWatch = null
			}
		}
	}

	$watchGroup(watchFns, listenerFn) {
		let self = this
		let newValues = new Array(watchFns.length)
		let oldValues = new Array(watchFns.length)
		let changeReactionScheduled = false
		let firstRun = true

		if(watchFns.length === 0) {
			let shouldCall = true
			self.$evalAsync(() => {
				if(shouldCall) {
					listenerFn(newValues, oldValues, self)
				}
			})
			return function() {
				shouldCall = false
			}
		}

		function watchGroupListener() {
			if (firstRun) {
				firstRun = false
				listenerFn(newValues, newValues, self)
			} else {
				listenerFn(newValues, oldValues, self)
			}
			changeReactionScheduled = false
		}

		let destroyFunctions = _.map(watchFns, (watchFn, i) => {
			return self.$watch(watchFn, (newValue, oldValue) => {
				newValues[i] = newValue
				oldValues[i] = oldValue
				if(!changeReactionScheduled) {
					changeReactionScheduled = true
					self.$evalAsync(watchGroupListener)
				}
			})
		})

		return function() {
			_.forEach(destroyFunctions, (destroyFunctions) => {
				destroyFunctions()
			})
		}
	}

	$$areEqual(newValue, oldValue, valueEq) {
		if(valueEq) {
			//console.log(newValue)
			//console.log(oldValue)
			return _.isEqual(newValue, oldValue)
		} else {
			return newValue === oldValue ||
			    //solve the corn case for NaN
						 (typeof newValue === 'number' && typeof oldValue === 'number' &&
						 	isNaN(newValue) && isNaN(oldValue))
		}
	}

	$digest() {
		let ttl = 10
		let dirty
		this.$root.$$lastDirtyWatch = null
		this.$beginPhase('$digest')

		if(this.$root.$$applyAsyncId) {
			clearTimeout(this.$$applyAsyncId)
			this.$$flushApplyAsync()
		}

		do {
			while (this.$$asyncQueue.length) {
				try {
					var asyncTask = this.$$asyncQueue.shift()
					asyncTask.scope.$eval(asyncTask.expression)
				} catch (e) {
					console.error(e)
				}
			}
			dirty = this.$digestOnce()
			//console.log(dirty)
			//we need to do is also check the status of the async queue in our TTL check
			if((dirty || this.$$asyncQueue.length) && !(ttl--)) {
				this.$clearPhase()
				throw "10 digest iteration reached"
			}
		} while (dirty || this.$$asyncQueue.length)
		this.$clearPhase()

		while (this.$$postDigestQueue.length) {
			try {
				this.$$postDigestQueue.shift()()
			} catch(e) {
				console.error();(e)
			}
		}
	}

	$digestOnce() {
		let self = this
		let dirty
		let continueLoop = true
		this.$$everyScope(function(scope) {
			let newValue, oldValue
			_.forEachRight(scope.$$watchers, (watcher) => {
			 try{
				if(watcher) {
				newValue = watcher.watchFn(scope)
				oldValue = watcher.last
				// console.log(newValue)
				// console.log(oldValue)
				if(!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
					scope.$root.$$lastDirtyWatch = watcher
					watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue)
					watcher.listenerFn(newValue,
						//we'd rather not leak that function outside of scope.js
							(oldValue === initWatchVal ? newValue : oldValue),
								scope)
					dirty = true
				} else if (scope.$root.$$lastDirtyWatch === watcher) {
					//recursive digestion
					continueLoop = false
					//short-circuiting the digest when the last watch is clean
					return false
					}
				}
			} catch (e) {
				console.error(e)
				}
			})
			return continueLoop
		})
		return dirty
	}

	$eval(expression, locals) {
		return expression(this, locals)
	}

	$apply(expression) {
		try {
			this.$beginPhase('$apply')
			return this.$eval(expression)
		} finally {
			this.$clearPhase()
			this.$root.$digest()
		}
	}

	$$postDigest(fn) {
		this.$$postDigestQueue.push(fn)
	}

	$evalAsync(expr) {
		let self = this
		//the $evalAsync function can now check the current phase of the scope, and if there isn't one, schedule the digest
		if(!self.$$phase && !self.$$asyncQueue.length) {
			setTimeout(function() {
				if(self.$$asyncQueue.length) {
					self.$root.$digest()
				}
			}, 0)
		}
		this.$$asyncQueue.push({scope: this, expression: expr})
	}

	$applyAsync(expr) {
		let self = this
		self.$$applyAsyncQueue.push(function() {
			self.$eval(expr)
		})

		if(self.$root.$$applyAsyncId === null) {
			self.$root.$$applyAsyncId = setTimeout(function() {
				self.$apply(_.bind(self.$$flushApplyAsync, self))
			}, 0)
		}
	}

	$$flushApplyAsync() {
		while(this.$$applyAsyncQueue.length) {
			this.$$applyAsyncQueue.shift()()
		}
		this.$$applyAsyncId = null
	}

	$beginPhase(phase) {
		if(this.$$phase) {
			throw this.$$phase + 'already in progress'
		}
		this.$$phase = phase
	}

	$clearPhase() {
		this.$$phase = null
	}

	//scope-inheritance
	//substituting the parent scope
	$new(isolated, parent) {
		let child
	  parent = parent || this
		if (isolated) {
			child = new Scope()
			child.$root = parent.$root
			child.$$asyncQueue = parent.$$asyncQueue
			child.$$postDigestQueue = parent.$$postDigestQueue
			child.$$applyAsyncQueue = parent.$$applyAsyncQueue
		} else {
			let ChildScope = function() { }
			ChildScope.prototype = this
			child = new ChildScope()
		}
		parent.$$children.push(child)
		child.$$watchers = []
		child.$$children = []
		child.$$listeners = {}
		child.$parent = parent
		return child
	}

	$$everyScope(fn) {
		if (fn(this)) {
			return this.$$children.every(function(child) {
				return child.$$everyScope(fn)
			})
		} else {
			return false
		}
	}

	//destroy a scope
	$destroy() {
		if(this === this.$root) {
			return;
		}

		var siblings = this.$parent.$$children
		var indexOfThis = siblings.indexOf(this)
		if(indexOfThis >= 0) {
			siblings.splice(indexOfThis, 1)
		}
	}

	//watching collection
	$watchCollection(watchFn, listenerFn) {
		let self = this
		let newValue
		let oldValue
		let oldLength
		let veryOldValue
		let trackVeryOldValue = (listenerFn.length > 1)
		let changeCount = 0
		let firstRun = true

		let internalWatchFn = (scope) => {
			let newLength, key
			newValue = watchFn(scope)

			if (_.isObject(newValue)) {
				if (_.isArrayLike(newValue)) {
					if (!_.isArray(oldValue)) {
						changeCount++
						oldValue = []
					}
					if (newValue.length !== oldValue.length) {
						changeCount++
						oldValue.length = newValue.length
					}
					_.forEach(newValue, (newItem, i) => {
						let bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i])
						if(newItem !== oldValue[i] && !bothNaN) {
							changeCount++
							oldValue[i] = newItem
						}
					})
				} else {
					if (!_.isObject(oldValue) || _.isArrayLike(oldValue)) {
						changeCount++
						oldValue = {}
						oldLength = 0
					}
					//preventing unnecessary object iteration
					newLength = 0
					_.forOwn(newValue, (newVal, key) => {
						newLength++
						if (oldValue.hasOwnProperty(key)) {
							let bothNaN = _.isNaN(oldValue[key]) && _.isNaN(newVal)
							if(!bothNaN && oldValue[key] !== newVal) {
								changeCount++
								oldValue[key] = newVal
							}
						} else {
							changeCount++
							oldLength++
							oldValue[key] = newVal
						}
					})
					if(oldLength > newLength) {
						changeCount++
						_.forOwn(oldValue, (oldVal, key) => {
							if (!newValue.hasOwnProperty(key)) {
								oldLength--
								delete oldValue[key]
							}
						})
					}
				}
			} else {
				if(!self.$$areEqual(newValue, oldValue, false)) {
					changeCount++
				}
				oldValue = newValue
			}

			return changeCount
		}

		let internalListenerFn = () => {
			if (firstRun) {
				listenerFn(newValue, newValue, self)
				firstRun = false
			} else {
				listenerFn(newValue, veryOldValue, self)
			}

			if(trackVeryOldValue) {
				veryOldValue = _.clone(newValue)
			}
		}

		return this.$watch(internalWatchFn, internalListenerFn)
	}

	//scope Events
	$on(eventName, listener) {
		let listeners = this.$$listeners[eventName]
		if (!listeners) {
			this.$$listeners[eventName] = listeners = []
		}
		listeners.push(listener)
		return function() {
			let index = listeners.indexOf(listener)
			if (index >= 0) {
				listeners[index] = null
			}
		}
	}

	$emit(eventName, ...additionalArgs) {
		var propagationStopped = false
		let event = {
			name: eventName,
			targetScope: this,
			stopPropagation() {
				propagationStopped = true
			},
			preventDefault() {
				event.defaultPrevented = true
			}
		}
		let listenerArgs = [event].concat(additionalArgs)
		let scope = this
		do {
			event.currentScope = scope
			scope.$$fireEventOnScope(eventName, listenerArgs)
			scope = scope.$parent
		} while (scope && !propagationStopped)
		event.currentScope = null
		return event
	}

	$broadcast(eventName, ...additionalArgs) {
		let event = {
			name: eventName,
			targetScope: this,
			preventDefault() {
				event.defaultPrevented = true
			}
		}
		let listenerArgs = [event].concat(additionalArgs)
	  this.$$everyScope(function(scope) {
			event.currentScope = scope
			scope.$$fireEventOnScope(eventName, listenerArgs)
			return true
		})
		event.currentScope = null
		return event
	}

	//dealing with duplication
	//return the event object
	$$fireEventOnScope(eventName, listenerArgs) {
		let listeners = this.$$listeners[eventName] || []
		let i = 0

		while (i < listeners.length) {
			if (listeners[i] === null) {
				listeners.splice(i, 1)
			} else {
				listeners[i].apply(null, listenerArgs)
				i++
			}
		}
		return event
	}

	//broadcasting scope removal
	$destroy() {
		if (this === this.$root) {
			return;
		}
		console.log(1)
		let siblings = this.$parent.$$children
		let indexOfThis = siblings.indexOf(this)
		if (indexOfThis >= 0) {
			this.$broadcast('$destroy')
			siblings.splice(indexOfThis, 1)
		}
	}
}
