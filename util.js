(function(x, factory){
	window.util = factory(window);
})(this, function(window){
	var class2type = {},
		types = ["String","Number","Array","Date","Boolean","Function","RegExp","Object","Error","Event"],
		_toString = class2type.toString,
		_slice = [].slice;
	function each(array, iterator){
		for(var i=0, len=array.length; i<len; i++){
			iterator(array[i], i);
		}
	}
	function update(array, args) {
		var arrayLength = array.length, length = args.length;
		while (length--) array[arrayLength + length] = args[length];
		return array;
	}
	each(types, function(type){
		class2type["[object "+type+"]"] = type.toLowerCase();
	});
	function type(o){
		return typeof o === 'undefined' ? 'undefined' : class2type[_toString.call(o)] || 'object';
	}
	function T(o, generic){
		return type(o) === generic;
	}
	
	//window.util just for test.
	var util= window.util = {
		extend: function(a, b){
			for(var i in b){
				a[i] = b[i]
			}
			return a;
		},
		observer: (function(box){
			//keys for better compatibility
			var Publisher={
				unquie: function(){
					this[" unquie"] = true;
					return this;
				},
				subscribe: function(fn, context, type){
					type = type || 'any';
					if(T(context, 'string')){
						type = context;
						context = window;
					}
					context = context || window;
					var fns = T(fn, 'array') ? fn : [fn];
					this.subscribers[type] = this.subscribers[type] || [];
					for(var i=0, len=fns.length; i<len; i++){
						var func = fns[i];
						func =  T(func, 'function') ? func : context[func];
						if( typeof func === 'function' && (!this[" unquie"] || !this.has(func))){
							this.subscribers[type].push([func, context]);
						}
					}
					return this;
				},
				unsubscribe: function(fn, type){
					type = type || 'any';
					this.subscribers[type].splice(this.subscribers[type].indexOf(fn), 1);
					return this;
				},
				shutdown: function(type){
					type = type || 'any';
					this.subscribers[type] = [];
					return this;
				},
				//可以替代isEmpty
				has: function(fn, type){
					var list = this.subscribers[type || 'any'] || [],
						i = 0,
						len = list.length;
					for(; i<len; i++){
						if(list[i][0]===fn || (list[i][0]).toString()===(fn).toString()){
							return true;
						}
					}
					return fn ? false : !!list.length;
				},
				//只有最后一个参数为string并且该订阅者队列存在时，才会fire该队列，否则使用默认队列
				//只有回调列表中的所有返回值都为不为false时，才会return true;队列中无函数时返回true
				publish: function(){
					var args = _slice.call(arguments, 0), type = args[args.length-1],
						i=0, object, results = [];
					type = T(type, 'string')&&T(this.subscribers[type], 'array') ? type : 'any';
					if(this.subscribers[type]){
						for(; i<this.subscribers[type].length; i++){
							object = this.subscribers[type][i];
							results[!!object[0].apply(object[1], args)] = 1;
						}
					}
					this.subscribers[type].published = true;
					var result = !('false' in results);
					try{
						this.subscribers[type].onpublished(result, results);
					}catch(e){}
					return result;
				},
				//only fire once.
				once: function(){
					var returned = this.publish.apply(this, arguments),
						type = arguments[arguments.length-1];
					type = T(type, 'string')&&T(this.subscribers[type], 'array') ? type : 'any';
					this.shutdown(type);
					return returned;
				},
				isEmpty: function(type){
					var subscribers = this.subscribers[type || 'any'];
					return !subscribers|| !subscribers.length;
				},
				//@Deprecated.Don't use it.
				onpublished: function(){
					var callbacks = this.callbacks = this.callbacks || util.observer(),
						type = arguments[arguments.length-1];
					type = T(type, 'string') ? type : 'any'
					callbacks.subscribe.apply(callbacks, arguments);
					this.subscribers[type].onpublished = function(){
						return callbacks.publish.apply(callbacks, _slice.call(arguments, 0).concat(type));
					}
					if(this.subscribers[type].published){
						this.subscribers[type].onpublished();
					}
					return this;
				}
			};
			return function(o){
				return util.extend(util.extend(o || {}, Publisher), {	//add shortcut.
					add: Publisher.subscribe,
					remove: Publisher.unsubscribe,
					fire: Publisher.publish,
					fired: Publisher.onpublished,	//@Deprecated.Don't use it.
					subscribers: {any: []}
				});
			};
		})(),
		getStore: (function(){
			var store = {
				name: 'fakeLocalStorage',
				options: {
					//domain: "wecash.net",
					path: "/",
					expires: 365
				},
				setItem: function(key, value, options){
					return store._resetItem(function(data){
						data[key] = value;//store[key] = 
						return data;
					}, key);
				},
				getItem: function(key){
					return store._get()[key];
				},
				removeItem: function(key){
					return store._resetItem(function(data){
						delete data[key];
						return data;
					}, key);
				},
				clear: function(){
					return store._resetItem(function(data){
						return {};
					});
				},
				_resetItem: function(operate, key, options){
					options = options || store.options;
					var t = new Date(), storage = store._get() || {};
					t.setDate(+t.getDate() + options.expires);
					options.expires = t.toGMTString();
					operate&&(storage = operate(storage));
					document.cookie = [
							this.name, '=', escape(JSON.stringify(storage)),
							options.expires ? '; expires=' + options.expires : '', // use expires attribute, max-age is not supported by IE
							options.path    ? '; path=' + options.path : '',
							options.domain  ? '; domain=' + options.domain : '',
							options.secure  ? '; secure' : ''
						].join('');
					return storage[key];
				},
				_get: function(){
					var cookie = document.cookie.match(new RegExp(this.name+"=(.*?)(?:;|$)"));
					try{
						return JSON.parse(cookie ? unescape(cookie[1]) : "{}");
					}catch(e){
						return {};
					}
				}
			};
			return function(){
				return store;
			};
		}()),
		now: function(a, b){
			return util.formatDate(new Date(), a, b);
		},
		doOperator: function(setups, teardowns){
			setups = setup(setups);
			teardowns = setup(teardowns);
			var fnStr = 'function';
			
			return function(operate){
				if(typeof operate!==fnStr)return util.x;
				return function(){
					var args = _slice.call(arguments),
						context = this,
						setupReturned = fire(setups, context, args);
					if(false===setupReturned)return setupReturned;
					
					if(setupReturned.length){
						args.push(setupReturned);
					}
					
					var returned = operate.apply(context, args);
					if(returned&&typeof(returned.promise)===fnStr){
						return returned.always(fire.bind(context, context, teardowns));
					}
					if(setupReturned.length){
						args.push(setupReturned);
					}
					
					fire(teardowns, context, typeof returned==='undefined' ? args : args.concat(returned));
					return returned;
				}
			}
			
			function fire(fns, context, args){
				var results = [];
				for(var i=0, fn, ret, len=fns.length; i<len; i++){
					fn = fns[i];
					ret = fn.apply(context, args);
					if(false===ret)return ret;
					results.push(ret);
				}
				return results;
			}
			
			function setup(fns){
				if(!fns){
					fns = util.noop;
				}
				if(!T(fns, 'array')){
					fns = [fns];
				}
				return fns;
			}
		},
		formatDate: function(date, a, b){
			date.date = [date.getFullYear(), util.pad(date.getMonth()+1), util.pad(date.getDate())].join(a||'-');
			date.time = [util.pad(date.getHours()), util.pad(date.getMinutes()), util.pad(date.getSeconds())].join(b||':');
			return date;
		},
		noop: function(){},
		//To detect if the fn has been called.
		wrapper: function(fn, callback){
			return T(fn, 'function') ? function(){
				if("__called" in fn)return;
				var func = util.observer();
				func.subscribe([fn, function(){
					fn.__called = true;
				}], this).publish.apply(func, arguments);
				func.shutdown().subscribe(callback||util.noop).publish();
			} : fn;
		},
		//Simple Promise Object.
		Promise: function(func){
			var tuples = [
					['Fulfilled', util.observer(), 'resolve', 'done'],
					['Rejected', util.observer(), 'reject', 'fail']
				],
				state = 'Pending',
				
			promise = {
				then: function(/*onFulfilled, onRejected*/){
					var fns = arguments;
					return util.Promise(function(newPromise){
						each(tuples, function(tuple, i){
							var fn = T(fns[i], 'function')&&fns[i];
							promise[ tuple[3] ] (function(){
								//slice the publish factory argument.
								var returned = fn && fn.apply( this, _slice.call(arguments, 0, arguments.length-1) );
								if(returned && T(returned.promise, 'function')){
									returned.done(newPromise.resolve)
										.fail(newPromise.reject);
								}else{
									newPromise[ tuple[2] ].call(this, returned);
								}
							});
						});
						fns = null;
					});
				},
				always: function(){
					promise.done(arguments).fail(arguments);
					return this;
				},
				state: function(){
					return state;
				},
				promise: function(obj){
					return obj? util.extend(obj, promise) : promise;
				}
			};
			
			each(tuples, function(tuple){
				var observer = tuple[1],
					list = tuple[3];
				//once it fired, shut it down.
				promise[ list ] = function(){
					observer.subscribe.call(observer, _slice.call(arguments, 0)[0], this, list);
					return this;
				};
				promise[ tuple[2] ] = function(){
					state = tuple[0];
					observer.publish.apply(observer, _slice.call(arguments, 0).concat(list));
					observer.shutdown(list);
					return this;
				};
			});
			if ( func ) {
				func.call( promise, promise );
			}
			
			return promise;
		},
		/*两种接口，a、预定义指定方法执行完成。b、给指定对象添加done方法表示执行完成
		 * fire方法添加/修改 回调函数
		 * done方法表明一个操作处理完成
		 * add方法增加需要等待的操作
		 * once方法表明只执行一次
		 */
		//删除不常用的使用方式，只留下字符串形式的代表异步操作的方式
		Async: function(){
			var operations = _slice.call(arguments, 0),
				//determine operations done or not.
				remaind = operations.length,
				//put all arguments into args,
				allArgs = [],
				onceFns = [],
				//add callbacks when all operations done.
				callbacks = util.observer().unquie(),
			async = {
				fire: function(){
					callbacks.add.apply(callbacks, arguments);
					return async;
				},
				once: function(fn){
					onceFns.push(fn);
					return async.fire.apply(async, arguments);
				},
				add: function(){
					remaind++;
					operations.push.apply(operations, arguments);
					return async;
				},
				remove: function(operation){
					var idx = operations.indexOf(operation);
					if(idx!=-1){
						allArgs.splice(idx, 1);
						operations.splice(idx, 1);
						remaind--;
						fire();
					}
					return async;
				},
				done: function(){
					var args = _slice.call(arguments),
						operation = args.shift(),
						idx = operations.indexOf(operation);
					if(idx!=-1){
						remaind--;
						allArgs[idx] = args;
						fire();
					}
					return async;
				}
			};
			function fire(){
				if(!!remaind)return async;
				callbacks.fire.apply(callbacks, allArgs);
				remaind = operations.length;
				var fn;
				while( (fn = onceFns.pop()) ){
					callbacks.remove(fn);
				}
				return async;
			}
			return async;
		},
		//同步对象，lock住的方法返回一个被修改的函数对象，除非主动调用unlock，否则再次调用该方法不执行操作。
		Sync: function(callback){
			//the master observer.
			var synch = util.observer();
			return {
				//lock the defer callback
				lock: function(){
					var results = [];
					each(arguments, function(func){
						//To prevent cover any methods.
						var name = " "+(func.name || func.toString());
						synch[name] = util.wrapper(func, function(){
							synch.subscribe(function(){
								delete func.__called;
							}, this, name);
						});
						results.push(synch[name]);
						
					});
					T(callback, 'function')&&callback.apply(this, results);
					return results.length>1 ? results : results[0];
				},
				//only process an wrapped func.不能同步调用unlock，会被重置为lock状态。
				unlock: function(){
					each(arguments, function(func){
						for(var name in synch){
							if(synch[name] === func)
								break;
						}
						synch.publish(name);
						delete synch.subscribers[name];
					});
					return arguments;
				}
			}
		},
		quickSort: (function(){
			return function quickSort(arr, juge){
				if(arr.length<=1)return arr;
				var random = Math.ceil(Math.random()*arr.length)/2;
				var left = [], right = [];
				var middle = arr.splice(random, 1)[0];
				for(var i=0, len=arr.length;i<len;i++){
					if(juge(arr[i], middle)){
						right.push(arr[i]);
					}else { 
						left.push(arr[i]);
					}
				}
				return quickSort.call(null, left, juge).concat([middle], quickSort.call(null, right, juge))
			}
		}()),
		bind: function(fn, context){
			var args = arguments;
			if(args.length < 2) return fn;
			args = _slice.call(args, 2);
			return function(){
				return fn.apply(context, args.concat(_slice.call(arguments, 0)));
			}
		},
		//simple error handler
		error: function(msg){
			msg = T(msg, 'string')&&msg || '系统繁忙，请稍后再试！';
			if(loadingTip){
				loadingTip.show(msg);
			}else{
				console.error('error msg in util.js');
			}
			return false;
		},
		truncate: function(str, len, replacement){
			replacement = replacement || '...';
			var length = 0;   
			/*
			for(i=0; i<str.length; i++) {   
				if(str.charCodeAt(i)>256) {   
					length += 2;   
				} else {   
					length++;   
				}   
			}
			*/
			return (replacement===true&&length<len*2 || str.length<len) ? str : str.substr(0, len)+replacement;
		},
		//get random number between start and end.
		random: function(start, end){
			return Math.round((Math.random())*Math.abs(end-start)+Math.min.apply(this, arguments));
		},
		//find element that relate to elem recursively.
		relate: function(elem, relative, judge){
			while ( !judge(elem = elem[relative]) ){}
			return elem;
		},
		//usage: pad('aa', 4, 'x'); --> 'xxaa'
		pad: function (str, count, replacement){
			str = String(str);
			replacement = replacement || "0";
			count = count||2;
			var tmp = {
				length: +count-str.length+1
			};
			return (_slice.call(tmp, 0).join(replacement)+str).slice(-count);
		},
		date: function(year, month, day){
			var date = new Date();
			if(!T(day, 'undefined')){
				date.setFullYear(year);
				date.setMonth(month);
				date.setDate(day);
			}
			return date;
		},
		dateFormat: function(){
			var date = T(arguments[0], 'date')? arguments[0]: util.date.apply(util, arguments);
			return [date.getFullYear(), '年', ("0"+(date.getMonth()+1)).slice(-2), '月', ("0"+date.getDate()).slice(-2), '日'].join('');
		},
		create: function(o){
			function F(){}
			F.prototype = o;
			return new F();
		},
		page: function(fn){
			$(window).scroll(function(){
				var scrollTop = $(this).scrollTop(),
					scrollHeight = $(document).height(),
					windowHeight = $(this).height();
				if(scrollTop + windowHeight >= scrollHeight-20){
					T(fn, 'function')&&fn();
				}
			});
		},
		region: function(value, sections, fn){
			var i=0, len=sections.length, section, current;
			for(; i<len; i++){
				current = sections[i];
				section = current.section;
				if(value >= section[0] && value<= (section[1]||Infinity)){
					return fn(current.map, i, section, value);
				}
			}
			return false;
		},
		delay: function(fn, args, context, timeout){
			if(!arguments.length)return false;
			if(!T(args, 'array')){
				timeout = context;
				context = args;
				args = [];
			}
			if(T(context, 'number')){
				timeout = context;
				context = undefined;
			}
			timeout = timeout || 100;
			context = context || this;
			return setTimeout(function(){
				fn.apply(context, args);
			}, timeout);
		},
		//config: [{selector: [events]}]
		calc: function(config, formula, context){
			formula = config.formula || formula;
			context = config.context || context;
			var elems = [], i=0, l=config.length;
			for(;i<l; i++){
				$.each(config[i], function(selector, events){
					var elem = $(selector),
						events = $.isArray(events) ? events : [events];
					elems.push(elem);
					$.each(events, function(i, event){
						elem[event](calculate);
					});
				});
			}
			
			var array = [];
			function calculate(){
				var tmp;
				while( (tmp = array.pop()) ){
					clearTimeout(tmp);
				}
				array.push(util.delay(formula, $.map(elems, function(elem){
					return elem.val();
				}), context));
			}
			return array;
		},
		slice: function(arr, len){
			var i=0, ret = [], length = arr.length;
			while(i*len < length){
				ret.push(arr.slice(i++*len, len*i));
			}
			return ret;
		},
		getParam: (function(){
			var param_cache = {},
				href = location.href;
			
			return function(name, reget){
				if(reget!==true && typeof(param_cache[name])!=='undefined'){
					return param_cache[name];
				}
				var ret = href.match(new RegExp(name+'=(.*?)(?:\&|$)'));
				ret = ret ? ret[1] : ret;
				param_cache[name] = ret;
				if(!ret)return ret;
				return decodeURIComponent(ret);
			}
		})(),
		domReady: (function(){
			var readyList;
			function detach() {
				if ( document.addEventListener ) {
					document.removeEventListener( "DOMContentLoaded", completed, false );
					window.removeEventListener( "load", completed, false );

				} else {
					document.detachEvent( "onreadystatechange", completed );
					window.detachEvent( "onload", completed );
				}
			}

			function completed() {
				if ( document.addEventListener || event.type === "load" || document.readyState === "complete" ) {
					detach();
					readyList.resolve();
				}
			}
			
			return function(fn){
				if(!readyList){
					readyList = util.Promise();
				}
				readyList.done(fn);
				if(document.readyState==='complete'){
					readyList.resolve();
				}else if(document.addEventListener){
					document.addEventListener( "DOMContentLoaded", completed, false );  
					window.addEventListener( "load", completed, false );  
				}else{
					document.attachEvent( "onreadystatechange", completed );  
					window.attachEvent( "onload", completed );  
					var top = false;  
					try {  
						top = window.frameElement == null && document.documentElement;  
					} catch(e) {}  
		  
					if ( top && top.doScroll ) {  
						(function doScrollCheck() {  
							try {  
								top.doScroll("left");  
							} catch(e) {  
								return setTimeout( doScrollCheck, 50 );  
							}  
	  
							// detach all dom ready events  
							detach();  
	  
							// and execute any waiting functions  
							readyList.resolve(); 
						})();  
					}  
				}
			}
		})(),
		bootstrap: function(ng){
			ng = ng || angular;
			util.domReady(loaded);
			function loaded(){
				ng.bootstrap(document, ['o2o']);
			}
		},
		paramParse: function(url){
			var args = _slice.call(arguments, 1),
				ret = [], tmp,
				parseParams = util.parseParams;
			while((tmp = args.shift())){
				ret.push(parseParams(tmp));
			}
			return [url, ret.join('&')].join( /\?/.test(url) ? "&" :'?' ); 
		},
		parseParams: function(object){
			var ret = [], i, r20 = /%20/;
			for(i in object){
				ret.push(encodeURIComponent(i)+"="+encodeURIComponent(object[i]));
			}
			return ret.join("&").replace(r20, "+");
		}
	};
	
	
	return util;
});
