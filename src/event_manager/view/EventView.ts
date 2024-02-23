import { isFunction, isString, isUndefined } from 'underscore';
import { $, SetOptions, View } from '../../common';
import Component from '../../dom_components/model/Component';
import EditorModel from '../../editor/model/Editor';
import { capitalize } from '../../utils/mixins';
import Event from '../model/Event';

export default class EventView extends View<Event> {
  pfx: string;
  ppfx: string;
  config: any;
  clsField: string;
  eventxelInput!: HTMLInputElement;
  handlerelInput!: HTMLInputElement;
  einput?: HTMLInputElement;
  hinput?: HTMLInputElement;
  // input?: HTMLInputElement;
  $einput?: JQuery<HTMLInputElement>;
  $hinput?: JQuery<HTMLInputElement>;
  // $input?: JQuery<HTMLInputElement>;
  eventCapture!: string[];
  noLabel?: boolean;
  em: EditorModel;
  target: Component;
  createLabel?: (data: { label: string; component: Component; event: EventView }) => string | HTMLElement;
  createInput?: (data: ReturnType<EventView['getClbOpts']>) => string | HTMLElement;

  events: any = {};

  appendInput = true;

  /** @ts-ignore */
  attributes() {
    return this.model.get('attributes') || {};
  }

  templateLabel(cmp?: Component) {
    const { ppfx } = this;
    const label = this.getLabel();
    return `<div class="${ppfx}label" title="${label}">${label}</div>`;
  }

  templateInput(data: ReturnType<EventView['getClbOpts']>) {
    const { ppfx, clsField } = this;
    return `<div class="${clsField}">
      <div data-input></div>
      <div class="${ppfx}sel-arrow">
        <div class="${ppfx}d-s-arrow"></div>
      </div>
    </div>`;
  }

  constructor(o: any = {}) {
    super(o);
    const { config = {} } = o;
    const { model, eventCapture } = this;
    const { target } = model;
    this.config = config;
    this.em = config.em;
    this.ppfx = config.pStylePrefix || '';
    this.pfx = this.ppfx + config.stylePrefix || '';
    this.target = target;
    const { ppfx } = this;
    this.clsField = `${ppfx}field ${ppfx}field-select`;
    const evToListen: [string, any][] = [
      ['change:value', this.onValueChange],
      ['remove', this.removeView],
    ];
    evToListen.forEach(([event, clb]) => {
      model.off(event, clb);
      this.listenTo(model, event, clb);
    });
    model.view = this;
    this.listenTo(model, 'change:label', this.render);
    this.listenTo(model, 'change:placeholder', this.rerender);
    this.events = {};
    eventCapture.forEach(event => (this.events[event] = 'onChange'));
    this.delegateEvents();
    this.init();
  }

  getClbOpts() {
    return {
      component: this.target,
      event: this.model,
      eventxelInput: this.getEInputElem(),
      handlerelInput: this.getHInputElem(),
    };
  }

  removeView() {
    this.remove();
    this.removed();
  }

  init() {}
  removed() {}
  onRender(props: ReturnType<EventView['getClbOpts']>) {}
  onUpdate(props: ReturnType<EventView['getClbOpts']>) {}
  onEvent(props: ReturnType<EventView['getClbOpts']> & { event: Event }) {}

  /**
   * Fires when the input is changed
   * @private
   */
  onChange(event: Event) {
    let el = this.getEInputElem();
    if (el && !isUndefined(el.value)) {
      this.model.set('value', el.value);
    }
    this.onEvent({
      ...this.getClbOpts(),
      event,
    });
    el = this.getHInputElem();
    if (el && !isUndefined(el.value)) {
      this.model.set('value', el.value);
    }
    this.onEvent({
      ...this.getClbOpts(),
      event,
    });
  }

  getValueForTarget() {
    return this.model.get('value');
  }

  setEInputValue(value: string) {
    const el = this.getEInputElem();
    el && (el.value = value);
  }
  setHInputValue(value: string) {
    const el = this.getHInputElem();
    el && (el.value = value);
  }

  /**
   * On change callback
   * @private
   */
  onValueChange(model: Event, value: string, opts: SetOptions & { fromTarget?: boolean } = {}) {
    if (opts.fromTarget) {
      // this.setEInputValue(model.get('eventx').value);
      // this.setHInputValue(model.get('handler').value);
      this.postUpdate();
    } else {
      const val = this.getValueForTarget();
      model.setTargetValue(val, opts);
    }
  }

  /**
   * Render label
   * @private
   */
  renderLabel() {
    const { $el, target } = this;
    const label = this.getLabel();
    let tpl: string | HTMLElement = this.templateLabel(target);

    if (this.createLabel) {
      tpl =
        this.createLabel({
          label,
          component: target,
          event: this,
        }) || '';
    }

    $el.find('[data-label]').append(tpl);
  }

  /**
   * Returns label for the input
   * @return {string}
   * @private
   */
  getLabel() {
    const { em } = this;
    const { label, name } = this.model.attributes;
    return em.t(`eventManager.events.labels.${name}`) || capitalize(label || name).replace(/-/g, ' ');
  }

  /**
   * Returns current target component
   */
  getComponent() {
    return this.target;
  }

  /**
   * Returns input element
   * @return {HTMLElement}
   * @private
   */
  getEventInputEl() {
    if (!this.$einput) {
      const { model, em } = this;
      const propName = model.get('name');
      const opts = model.get('eventx') || [];
      const values: string[] = [];
      let input = '<select>';

      opts.forEach(el => {
        let attrs = '';
        let name, value, style;

        if (isString(el)) {
          name = el;
          value = el;
        } else {
          name = el.name || el.label || el.value;
          value = `${isUndefined(el.value) ? el.id : el.value}`.replace(/"/g, '&quot;');
          style = el.style ? el.style.replace(/"/g, '&quot;') : '';
          attrs += style ? ` style="${style}"` : '';
        }
        const resultName = name;
        input += `<option value="${value}"${attrs}>${resultName}</option>`;
        values.push(value);
      });

      input += '</select>';
      this.$einput = $(input);
      const val = model.getTargetValue();
      const valResult = values.indexOf(val) >= 0 ? val : model.get('default');
      !isUndefined(valResult) && this.$einput!.val(valResult);
    }

    return this.$einput!.get(0);
  }
  getHandlerInputEl() {
    if (!this.$hinput) {
      const { model, em } = this;
      const propName = model.get('name');
      const opts = model.get('handler') || [];
      const values: string[] = [];
      let input = '<select>';

      opts.forEach(el => {
        let attrs = '';
        let name, value, style;

        if (isString(el)) {
          name = el;
          value = el;
        } else {
          name = el.name || el.label || el.value;
          value = `${isUndefined(el.value) ? el.id : el.value}`.replace(/"/g, '&quot;');
          style = el.style ? el.style.replace(/"/g, '&quot;') : '';
          attrs += style ? ` style="${style}"` : '';
        }
        const resultName = name;
        input += `<option value="${value}"${attrs}>${resultName}</option>`;
        values.push(value);
      });

      input += '</select>';
      this.$hinput = $(input);
      const val = model.getTargetValue();
      const valResult = values.indexOf(val) >= 0 ? val : model.get('default');
      !isUndefined(valResult) && this.$hinput!.val(valResult);
    }

    return this.$hinput!.get(0);
  }
  getInputEl() {
    // if (!this.$input) {
    //   const { model, em } = this;
    //   const propName = model.get('name');
    //   const opts = model.get('options') || [];
    //   const values: string[] = [];
    //   let input = '<select>';
    //   opts.forEach((el) => {
    //     let attrs = '';
    //     let name, value, style;
    //     if (isString(el)) {
    //       name = el;
    //       value = el;
    //     } else {
    //       name = el.name || el.label || el.value;
    //       value = `${isUndefined(el.value) ? el.id : el.value}`.replace(/"/g, '&quot;');
    //       style = el.style ? el.style.replace(/"/g, '&quot;') : '';
    //       attrs += style ? ` style="${style}"` : '';
    //     }
    //     const resultName = name;
    //     input += `<option value="${value}"${attrs}>${resultName}</option>`;
    //     values.push(value);
    //   });
    //   input += '</select>';
    //   this.$input = $(input);
    //   const val = model.getTargetValue();
    //   const valResult = values.indexOf(val) >= 0 ? val : model.get('default');
    // //   !isUndefined(valResult) && this.$input!.val(valResult);
    // }
    // return this.$input!.get(0);
  }

  getEInputElem() {
    const { einput, $einput } = this;
    return einput || ($einput && $einput.get && $einput.get(0)) || this.getEElInput();
  }
  getHInputElem() {
    const { hinput, $hinput } = this;
    return hinput || ($hinput && $hinput.get && $hinput.get(0)) || this.getHElInput();
  }

  getModelValue() {
    let value;
    const model = this.model;
    const target = this.target;
    const name = model.getName();

    if (model.get('changeProp')) {
      value = target.get(name);
    } else {
      const attrs = target.get('attributes')!;
      value = model.get('value') || attrs[name];
    }

    return !isUndefined(value) ? value : '';
  }

  getEElInput() {
    return this.eventxelInput;
  }
  getHElInput() {
    return this.handlerelInput;
  }

  /**
   * Renders input
   * @private
   * */
  renderEventField() {
    const { $el, appendInput, model } = this;
    let inputs = $el.find('[data-input]');
    const eel = inputs[0];
    let etpl: HTMLElement | string | undefined = model.el;

    if (!etpl) {
      etpl = this.getEventInputEl();
    }

    if (isString(etpl)) {
      eel.innerHTML = etpl;
      this.handlerelInput = eel.firstChild as HTMLInputElement;
    } else {
      appendInput ? eel.appendChild(etpl!) : eel.insertBefore(etpl!, eel.firstChild);
      this.handlerelInput = etpl as HTMLInputElement;
    }
    inputs = $el.find('[data-input]');
    const el = inputs[1];
    let tpl: HTMLElement | string | undefined = model.el;

    if (!tpl) {
      tpl = this.getHandlerInputEl();
    }

    if (isString(tpl)) {
      el.innerHTML = tpl;
      this.eventxelInput = el.firstChild as HTMLInputElement;
    } else {
      appendInput ? el.appendChild(tpl!) : el.insertBefore(tpl!, el.firstChild);
      this.eventxelInput = tpl as HTMLInputElement;
    }
  }

  hasLabel() {
    const { label } = this.model.attributes;
    return !this.noLabel && label !== false;
  }

  rerender() {
    delete this.model.el;
    this.render();
  }

  postUpdate() {
    this.onUpdate(this.getClbOpts());
  }

  render() {
    const { $el, pfx, ppfx, model } = this;
    const { type, id } = model.attributes;
    const hasLabel = this.hasLabel && this.hasLabel();
    const cls = `${pfx}event`;
    delete this.$hinput;
    delete this.$einput;
    let tmpl = `<div class="${cls} ${cls}--select">
      <div class="${ppfx}label-wrp" data-label>
        <div class="gjs-label" title="Event">Event</div>
      </div>
      <div class="${ppfx}field-wrp ${ppfx}field-wrp--select" data-eventx-input>
        ${
          this.templateInput
            ? isFunction(this.templateInput)
              ? this.templateInput(this.getClbOpts())
              : this.templateInput
            : ''
        }
      </div>
    </div>`;
    tmpl += `<div class="${cls} ${cls}--select">
      <div class="${ppfx}label-wrp" data-label>
        <div class="gjs-label" title="Handler">Handler</div>
      </div>
      <div class="${ppfx}field-wrp ${ppfx}field-wrp--select" data-handler-input>
        ${
          this.templateInput
            ? isFunction(this.templateInput)
              ? this.templateInput(this.getClbOpts())
              : this.templateInput
            : ''
        }
      </div>
    </div>`;
    $el.empty().append(tmpl);
    this.renderEventField();
    this.el.className = `${cls}__wrp ${cls}__wrp-${id}`;
    this.postUpdate();
    this.onRender(this.getClbOpts());
    return this;
  }
}
EventView.prototype.eventCapture = ['change'];
