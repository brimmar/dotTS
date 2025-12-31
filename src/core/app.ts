import { Component } from './component';

export class App extends Component {
  constructor() {
    super('root');
  }
}

export class Stack extends Component {
  constructor(scope: App, id: string) {
    super(id);
    scope.add(this);
  }
}
