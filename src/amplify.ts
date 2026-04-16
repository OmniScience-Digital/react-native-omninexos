import { generateClient } from "aws-amplify/api";

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
