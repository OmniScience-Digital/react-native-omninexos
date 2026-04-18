import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";

Amplify.configure(outputs);

export const client = generateClient();
