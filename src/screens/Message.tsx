import type { ReactNode } from "react";

/** 오류·안내 화면. 막다른 화면이 되지 않도록 항상 행동 버튼을 함께 둔다. */
export function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page message">
      <h1 className="headline" role="alert">
        {title}
      </h1>
      <div className="message__actions">{children}</div>
    </main>
  );
}
