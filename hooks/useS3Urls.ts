// hooks/useS3Urls.ts
import { getUrl } from "aws-amplify/storage";
import { useEffect, useState } from "react";

export function useS3Urls(s3Keys: string[] | null | undefined) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!s3Keys || s3Keys.length === 0) {
      setUrls([]);
      return;
    }
    let isMounted = true;
    Promise.all(
      s3Keys.map(async (key) => {
        try {
          const { url } = await getUrl({ path: key });
          return url.toString();
        } catch {
          return "";
        }
      }),
    ).then((results) => {
      if (isMounted) setUrls(results.filter((url) => url !== ""));
    });
    return () => {
      isMounted = false;
    };
  }, [s3Keys]);

  return urls;
}
