import { generateClient } from "aws-amplify/api";

export const client = generateClient();
// import { generateClient } from "aws-amplify/api";

// const client = generateClient();

// const LIST_CATEGORIES = `
//   query ListCategories {
//     listCategories {
//       items {
//         id
//         categoryName
//         createdAt
//       }
//     }
//   }
// `;

// // Then inside an async function:
// const { data, errors } = (await client.graphql({
//   query: LIST_CATEGORIES,
//   authMode: "apiKey",
// })) as any;

// console.log(data.listCategories.items);
