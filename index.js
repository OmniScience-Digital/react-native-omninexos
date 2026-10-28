// index.js — app entry point.
//
// Why this file exists: the OS can wake the app with NO UI to run the background sync task. In that launch the
// router and its screens are not guaranteed to load, so the task must be defined here, in global scope, before
// anything else. Do not move this import into a screen or layout.
//
// Order matters: the task definition first (it pulls in src/amplify, which configures Amplify and the token
// storage), then the normal expo-router entry.
import "./src/jobcards/background";

import "expo-router/entry";
