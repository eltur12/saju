import { registerPlugin } from "@capacitor/core";

const Widget = registerPlugin("Widget");

export async function refreshWidget(): Promise<void> {
  try {
    await (Widget as { refresh: () => Promise<void> }).refresh();
  } catch {
    // 웹 브라우저 환경에서는 무시
  }
}
