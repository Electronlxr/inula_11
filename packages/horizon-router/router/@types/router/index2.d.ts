import { Location as HLocation } from '../history/types';
type Location<S = unknown> = Omit<HLocation<S>, 'key'>;
export { Location };
export type { History } from '../history/types';
export { createBrowserHistory } from '../history/browerHistory';
export { createHashHistory } from '../history/hashHistory';
export { default as __RouterContext } from './context';
export { matchPath, generatePath } from './matcher/parser';
export { useHistory, useLocation, useParams, useRouteMatch } from './hooks';
export { default as Route } from './Route';
export { default as Router } from './Router';
export { default as Switch } from './Switch';
export { default as Redirect } from './Redirect';
export { default as Prompt } from './Prompt';
export { default as withRouter } from './withRouter';
export { default as HashRouter } from './HashRouter';
export { default as BrowserRouter } from './BrowserRouter';
export { default as Link } from './Link';
export { default as NavLink } from './NavLink';
export type { RouteComponentProps, RouteChildrenProps, RouteProps } from './Route';
export { connectRouter, routerMiddleware } from '../connect-router';
export declare const ConnectedRouter: any;
export declare const ConnectedHRouter: any;