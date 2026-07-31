/* ForgeX compatibility helpers for older mobile browsers. */
(function (global) {
  'use strict';

  if (!Object.assign) {
    Object.assign = function (target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null');
      target = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        if (source == null) continue;
        for (var key in Object(source)) {
          if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
        }
      }
      return target;
    };
  }

  if (!Array.prototype.find) {
    Array.prototype.find = function (predicate, thisArg) {
      if (this == null || typeof predicate !== 'function') throw new TypeError();
      for (var i = 0; i < this.length; i++) {
        if (predicate.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }

  if (!Array.prototype.includes) {
    Array.prototype.includes = function (value, fromIndex) {
      var start = fromIndex || 0;
      for (var i = start < 0 ? Math.max(this.length + start, 0) : start; i < this.length; i++) {
        if (this[i] === value || (value !== value && this[i] !== this[i])) return true;
      }
      return false;
    };
  }

  if (!String.prototype.padStart) {
    String.prototype.padStart = function (length, fill) {
      var value = String(this);
      var padding = String(fill || ' ');
      while (value.length < length) value = padding + value;
      return value.slice(-length);
    };
  }

  if (global.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
  if (global.HTMLCollection && !HTMLCollection.prototype.forEach) HTMLCollection.prototype.forEach = Array.prototype.forEach;

  if (global.Element && !Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  }
  if (global.Element && !Element.prototype.closest) {
    Element.prototype.closest = function (selector) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches && el.matches(selector)) return el;
        el = el.parentElement;
      }
      return null;
    };
  }
})(window);
