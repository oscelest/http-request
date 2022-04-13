export enum HTTPRequestState {
  READY   = 0,
  OPENED  = 1,
  LOADING = 2,
  DONE    = 3,
  ERROR   = 4,
  TIMEOUT = 5,
  ABORTED = 6,
}

export default HTTPRequestState;
