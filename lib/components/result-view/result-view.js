/* @flow */

import { CompositeDisposable } from "atom";
import React from "react";
import { observer } from "mobx-react";
import { action, observable, toJS } from "mobx";
import Display, {
  DEFAULT_SCROLL_HEIGHT
} from "@nteract/display-area/lib/display";
import { transforms, displayOrder } from "./transforms";
import Status from "./status";

import type { IObservableValue } from "mobx";
import type OutputStore from "./../../store/output";
import type Kernel from "./../../kernel";

type Props = {
  store: OutputStore,
  kernel: ?Kernel,
  destroy: Function,
  showResult: boolean
};

@observer
class ResultViewComponent extends React.Component<Props> {
  el: ?HTMLElement;
  containerTooltip = new CompositeDisposable();
  buttonTooltip = new CompositeDisposable();
  closeTooltip = new CompositeDisposable();
  expanded: IObservableValue<boolean> = observable(false);

  getAllText = () => {
    if (!this.el) return "";
    return this.el.innerText ? this.el.innerText.trim() : "";
  };

  handleClick = (event: MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      this.openInEditor();
    } else {
      this.copyToClipboard();
    }
  };

  copyToClipboard = () => {
    atom.clipboard.write(this.getAllText());
    atom.notifications.addSuccess("Copied to clipboard");
  };

  openInEditor = () => {
    atom.workspace.open().then(editor => editor.insertText(this.getAllText()));
  };

  addCopyTooltip = (element: ?HTMLElement, comp: atom$CompositeDisposable) => {
    if (!element || !comp.disposables || comp.disposables.size > 0) return;
    comp.add(
      atom.tooltips.add(element, {
        title: `Click to copy,
          ${process.platform === "darwin"
            ? "Cmd"
            : "Ctrl"}+Click to open in editor`
      })
    );
  };

  addCloseButtonTooltip = (
    element: ?HTMLElement,
    comp: atom$CompositeDisposable
  ) => {
    if (!element || !comp.disposables || comp.disposables.size > 0) return;
    comp.add(
      atom.tooltips.add(element, {
        title: this.props.store.executionCount
          ? `Close (Out[${this.props.store.executionCount}])`
          : "Close result"
      })
    );
  };

  addCopyButtonTooltip = (element: ?HTMLElement) => {
    this.addCopyTooltip(element, this.buttonTooltip);
  };

  onWheel = (element: HTMLElement) => {
    return (event: WheelEvent) => {
      const clientHeight = element.clientHeight;
      const scrollHeight = element.scrollHeight;
      const scrollTop = element.scrollTop;
      const atTop = scrollTop !== 0 && event.deltaY < 0;
      const atBottom =
        scrollTop !== scrollHeight - clientHeight && event.deltaY > 0;

      if (clientHeight < scrollHeight && (atTop || atBottom)) {
        event.stopPropagation();
      }
    };
  };

  @action
  toggleExpand = () => {
    this.expanded.set(!this.expanded.get());
  };

  render() {
    const { outputs, status, isPlain, position } = this.props.store;

    const inlineStyle = {
      marginLeft: `${position.lineLength + position.charWidth}px`,
      marginTop: `-${position.lineHeight}px`
    };

    if (outputs.length === 0 || this.props.showResult === false) {
      const kernel = this.props.kernel;
      return (
        <Status
          status={
            kernel && kernel.executionState !== "busy" && status === "running"
              ? "error"
              : status
          }
          style={inlineStyle}
        />
      );
    }

    return (
      <div
        className={isPlain ? "inline-container" : "multiline-container"}
        onClick={isPlain ? this.handleClick : false}
        style={
          isPlain
            ? inlineStyle
            : { maxWidth: `${position.editorWidth}ch`, margin: "0px" }
        }
      >
        <Display
          ref={ref => {
            if (!ref || !ref.el) return;
            this.el = ref.el;

            isPlain
              ? this.addCopyTooltip(ref.el, this.containerTooltip)
              : this.containerTooltip.dispose();

            // React's event handler doesn't properly handle event.stopPropagation() for
            // events outside the React context. Using proxy.el saves us a extra div.
            // We only need this in the text editor, therefore we check showStatus.
            if (!this.expanded.get() && !isPlain && ref.el) {
              ref.el.addEventListener("wheel", this.onWheel(ref.el), {
                passive: true
              });
            }
          }}
          outputs={toJS(outputs)}
          displayOrder={displayOrder}
          transforms={transforms}
          theme="light"
          models={{}}
          expanded={this.expanded.get()}
        />
        {isPlain ? null : (
          <div className="toolbar">
            <div
              className="icon icon-x"
              onClick={this.props.destroy}
              ref={ref => this.addCloseButtonTooltip(ref, this.closeTooltip)}
            />

            <div style={{ flex: 1, minHeight: "0.25em" }} />

            {this.getAllText().length > 0 ? (
              <div
                className="icon icon-clippy"
                onClick={this.handleClick}
                ref={this.addCopyButtonTooltip}
              />
            ) : null}

            {this.el && this.el.scrollHeight > DEFAULT_SCROLL_HEIGHT ? (
              <div
                className={`icon icon-${this.expanded.get()
                  ? "fold"
                  : "unfold"}`}
                onClick={this.toggleExpand}
              />
            ) : null}
          </div>
        )}
      </div>
    );
  }

  scrollToBottom() {
    if (
      !this.el ||
      this.expanded === true ||
      this.props.store.isPlain === true ||
      atom.config.get(`Hydrogen.autoScroll`) === false
    )
      return;
    const scrollHeight = this.el.scrollHeight;
    const height = this.el.clientHeight;
    const maxScrollTop = scrollHeight - height;
    this.el.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  componentDidMount() {
    this.scrollToBottom();
  }

  componentWillUnmount() {
    this.containerTooltip.dispose();
    this.buttonTooltip.dispose();
    this.closeTooltip.dispose();
  }
}

export default ResultViewComponent;
