/**
 * You can customize the initial state of the module from the editor initialization, by passing the following [Configuration Object](https://github.com/artf/grapesjs/blob/master/src/storage_manager/config/config.js)
 * ```js
 * const editor = grapesjs.init({
 *  storageManager: {
 *    // options
 *  }
 * })
 * ```
 *
 * Once the editor is instantiated you can use its API and listen to its events. Before using these methods, you should get the module from the instance.
 *
 * ```js
 * // Listen to events
 * editor.on('storage:start', () => { ... });
 *
 * // Use the API
 * const storageManager = editor.StorageManager;
 * storageManager.add(...);
 * ```
 *
 * ## Available Events
 * * `storage:start` - Before the storage request is started
 * * `storage:start:store` - Before the store request. The object to store is passed as an argumnet (which you can edit)
 * * `storage:start:load` - Before the load request. Items to load are passed as an argumnet (which you can edit)
 * * `storage:load` - Triggered when something was loaded from the storage, loaded object passed as an argumnet
 * * `storage:store` - Triggered when something is stored to the storage, stored object passed as an argumnet
 * * `storage:end` - After the storage request is ended
 * * `storage:end:store` - After the store request
 * * `storage:end:load` - After the load request
 * * `storage:error` - On any error on storage request, passes the error as an argument
 * * `storage:error:store` - Error on store request, passes the error as an argument
 * * `storage:error:load` - Error on load request, passes the error as an argument
 *
 * ## Methods
 * * [getConfig](#getconfig)
 * * [isAutosave](#isautosave)
 * * [setAutosave](#setautosave)
 * * [getStepsBeforeSave](#getstepsbeforesave)
 * * [setStepsBeforeSave](#setstepsbeforesave)
 * * [getStorages](#getstorages)
 * * [getCurrent](#getcurrent)
 * * [getCurrentStorage](#getcurrentstorage)
 * * [setCurrent](#setcurrent)
 * * [add](#add)
 * * [get](#get)
 * * [store](#store)
 * * [load](#load)
 *
 * @module StorageManager
 */

import defaults from './config/config';
import LocalStorage from './model/LocalStorage';
import RemoteStorage from './model/RemoteStorage';
import { deepMerge } from 'utils/mixins';

const eventStart = 'storage:start';
const eventAfter = 'storage:after';
const eventEnd = 'storage:end';
const eventError = 'storage:error';

export default () => {
  var c = {};
  let em;
  var storages = {};
  var defaultStorages = {};

  return {
    name: 'StorageManager',

    init(config = {}) {
      c = deepMerge(defaults, config);
      em = c.em;
      if (c._disable) c.type = 0;
      defaultStorages.remote = new RemoteStorage(c);
      defaultStorages.local = new LocalStorage(c);
      c.currentStorage = c.type;
      this.loadDefaultProviders().setCurrent(c.type);
      return this;
    },

    /**
     * Get configuration object
     * @return {Object}
     * */
    getConfig() {
      return c;
    },

    /**
     * Checks if autosave is enabled
     * @return {Boolean}
     * */
    isAutosave() {
      return !!c.autosave;
    },

    /**
     * Set autosave value
     * @param  {Boolean}  v
     * @return {this}
     * */
    setAutosave(v) {
      c.autosave = !!v;
      return this;
    },

    /**
     * Returns number of steps required before trigger autosave
     * @return {number}
     * */
    getStepsBeforeSave() {
      return c.stepsBeforeSave;
    },

    /**
     * Set steps required before trigger autosave
     * @param  {number} v
     * @return {this}
     * */
    setStepsBeforeSave(v) {
      c.stepsBeforeSave = v;
      return this;
    },

    /**
     * Add new storage
     * @param {string} id Storage ID
     * @param  {Object} storage Storage wrapper
     * @param  {Function} storage.load Load method
     * @param  {Function} storage.store Store method
     * @return {this}
     * @example
     * storageManager.add('local2', {
     *   load: function(keys, clb, clbErr) {
     *     var res = {};
     *     for (var i = 0, len = keys.length; i < len; i++){
     *       var v = localStorage.getItem(keys[i]);
     *       if(v) res[keys[i]] = v;
     *     }
     *     clb(res); // might be called inside some async method
     *     // In case of errors...
     *     // clbErr('Went something wrong');
     *   },
     *   store: function(data, clb, clbErr) {
     *     for(var key in data)
     *       localStorage.setItem(key, data[key]);
     *     clb(); // might be called inside some async method
     *   }
     * });
     * */
    add(id, storage) {
      storages[id] = storage;
      return this;
    },

    /**
     * Returns storage by id
     * @param {string} id Storage ID
     * @return {Object|null}
     * */
    get(id) {
      return storages[id] || null;
    },

    /**
     * Returns all storages
     * @return   {Array}
     * */
    getStorages() {
      return storages;
    },

    /**
     * Returns current storage type
     * @return {string}
     * */
    getCurrent() {
      return c.currentStorage;
    },

    /**
     * Set current storage type
     * @param {string} id Storage ID
     * @return {this}
     * */
    setCurrent(id) {
      c.currentStorage = id;
      return this;
    },

    /**
     * Store data in the current storage.
     * @param {Object} data Project data.
     * @param {Object} [options] Storage options.
     * @returns {Object} Stored data.
     * @example
     * const data = editor.getProjectData();
     * await storageManager.store(data);
     * */
    async store(data, options = {}) {
      const st = this.getCurrentStorage();
      const opts = { ...this.getCurrentOptons(), ...options };

      return await this.__exec(st, opts, data);
    },

    /**
     * Load resource from the current storage by keys
     * @param {Object} [options] Storage options.
     * @returns {Object} Loaded data.
     * @example
     * const data = await storageManager.load();
     * editor.loadProjectData(data);
     * */
    async load(options = {}) {
      const st = this.getCurrentStorage();
      const opts = { ...this.getCurrentOptons(), ...options };
      const result = await this.__exec(st, opts);

      return result;
    },

    async __exec(storage, opts, data) {
      const ev = data ? 'store' : 'load';
      let result;

      this.onStart(ev, data);

      if (!storage) {
        return data || {};
      }

      try {
        if (data) {
          const toStore = (opts.onStore && (await opts.onStore(data))) || data;
          await storage.store(toStore, opts);
          result = data;
        } else {
          result = await storage.load(opts);
          result = this.__clearKeys(result);
          result = (opts.onLoad && (await opts.onLoad(result))) || result;
        }
        this.onAfter(ev, result);
        this.onEnd(ev, result);
      } catch (error) {
        this.onError(ev, error);
        throw error;
      }

      return result;
    },

    /**
     * Restore key names
     * @param {Object} data
     * @returns {Object}
     * @private
     */
    __clearKeys(data = {}) {
      const result = {};
      const reg = new RegExp('^' + c.id + '');

      for (let itemKey in data) {
        const itemKeyR = itemKey.replace(reg, '');
        result[itemKeyR] = data[itemKey];
      }

      return result;
    },

    /**
     * Load default storages
     * @return {this}
     * @private
     * */
    loadDefaultProviders() {
      for (var id in defaultStorages) this.add(id, defaultStorages[id]);
      return this;
    },

    /**
     * Get current storage
     * @return {Storage}
     * */
    getCurrentStorage() {
      return this.get(this.getCurrent());
    },

    getCurrentOptons() {
      const config = this.getConfig();
      const current = this.getCurrent();
      return config.options[current] || {};
    },

    /**
     * On start callback
     * @private
     */
    onStart(ctx, data) {
      if (em) {
        em.trigger(eventStart);
        ctx && em.trigger(`${eventStart}:${ctx}`, data);
      }
    },

    /**
     * On after callback (before passing data to the callback)
     * @private
     */
    onAfter(ctx, data) {
      if (em) {
        em.trigger(eventAfter);
        em.trigger(`${eventAfter}:${ctx}`, data);
        em.trigger(`storage:${ctx}`, data);
      }
    },

    /**
     * On end callback
     * @private
     */
    onEnd(ctx, data) {
      if (em) {
        em.trigger(eventEnd);
        ctx && em.trigger(`${eventEnd}:${ctx}`, data);
      }
    },

    /**
     * On error callback
     * @private
     */
    onError(ctx, data) {
      if (em) {
        em.trigger(eventError, data);
        ctx && em.trigger(`${eventError}:${ctx}`, data);
        this.onEnd(ctx, data);
      }
    },

    /**
     * Check if autoload is possible
     * @return {Boolean}
     * @private
     * */
    canAutoload() {
      const storage = this.getCurrentStorage();
      return storage && this.getConfig().autoload;
    },

    destroy() {
      [c, em, storages, defaultStorages].forEach(i => (i = {}));
    },
  };
};
