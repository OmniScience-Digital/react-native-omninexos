import outputs from "@/amplify_outputs.json";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import "react-native-get-random-values"; // required by AppSync realtime (subscriptions)

Amplify.configure(outputs);

// Where Cognito keeps the signed-in session. Set here (not in a screen) so it also applies when the OS wakes the
// app headless for a background sync: without it the task could not find the session and every call would fail.
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

export const client = generateClient();
