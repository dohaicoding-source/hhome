import { del, get, put } from "@vercel/blob";

export function storage() {
  return {
    async put(pathname: string, body: Uint8Array, options: { httpMetadata: { contentType: string } }) {
      const blob = await put(pathname, Buffer.from(body), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: options.httpMetadata.contentType,
      });
      return blob;
    },
    async get(pathname: string) {
      const result = await get(pathname, { access: "private" });
      return result?.statusCode === 200 ? { body: result.stream } : null;
    },
    async delete(pathnames: string | string[]) {
      await del(pathnames);
    },
  };
}
