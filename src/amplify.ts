import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";

Amplify.configure(outputs);

export const client = generateClient();

export const LIST_CATEGORIES = `
  query ListCategories {
    listCategories {
      items {
        id
        categoryName
        createdAt
        subcategories {
          items {
            id
            subcategoryName
            categoryId
          }
        }
      }
    }
  }
`;
