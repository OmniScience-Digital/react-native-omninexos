//Rtk query slice
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { client, LIST_CATEGORIES } from "../amplify";

export const categoriesApi = createApi({
  reducerPath: "categoriesApi",
  baseQuery: fakeBaseQuery(), // ✅ no REST base URL — Amplify handles transport
  endpoints: (builder) => ({
    listCategories: builder.query<Category[], void>({
      queryFn: async () => {
        const { data, errors } = (await client.graphql({
          query: LIST_CATEGORIES,
          authMode: "apiKey",
        })) as any;

        if (errors) return { error: errors[0].message };
        return { data: data.listCategories.items };
      },
    }),
  }),
});

export const { useListCategoriesQuery } = categoriesApi;
