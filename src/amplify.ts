import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import "react-native-get-random-values"; // required by AppSync realtime (subscriptions)

Amplify.configure(outputs);

export const client = generateClient();
