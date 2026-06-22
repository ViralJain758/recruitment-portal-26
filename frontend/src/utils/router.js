import { hasValidSession } from "./authStorage";

export const CANDIDATE_DETAILS_PATH = "/candidate-details";
export const DASHBOARD_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const routeViews = {
  [DASHBOARD_PATH]: "dashboard",
  [CANDIDATE_DETAILS_PATH]: "candidate-details",
  [LOGIN_PATH]: "login",
  [SIGNUP_PATH]: "signup",
};

export function routeForSession(route, authSession) {
  if (route === DASHBOARD_PATH && !hasValidSession(authSession)) {
    return LOGIN_PATH;
  }

  return route;
}

export function viewForRoute(route, authSession) {
  return routeViews[routeForSession(route, authSession)] || "signup";
}

export function currentView(authSession) {
  const nextRoute = routeForSession(window.location.pathname, authSession);

  pushRoute(nextRoute);

  return routeViews[nextRoute] || "signup";
}

export function pushRoute(route) {
  if (window.location.pathname !== route) {
    window.history.pushState({}, "", route);
  }
}
