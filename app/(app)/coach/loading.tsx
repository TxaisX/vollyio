function Sk({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded bg-chalk/10 ${className}`} />;
}

const BUBBLES = [
  { me: false, h: "h-16", w: "w-4/5" },
  { me: true, h: "h-8", w: "w-1/2" },
  { me: false, h: "h-20", w: "w-3/4" },
  { me: true, h: "h-8", w: "w-2/5" },
  { me: false, h: "h-12", w: "w-2/3" },
];

export default function CoachLoading() {
  return (
    <section
      className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col md:min-h-[calc(100dvh-4.5rem)]"
      aria-busy
    >
      <div>
        <Sk className="h-3 w-16" />
        <Sk className="mt-2 h-7 w-48" />
      </div>

      <div className="flex flex-1 flex-col gap-4 py-6">
        {BUBBLES.map((b, i) => (
          <div
            key={i}
            className={`flex flex-col ${b.me ? "items-end" : "items-start"}`}
          >
            <Sk
              className={`${b.h} ${b.w} max-w-[85%] rounded-2xl ${
                b.me ? "rounded-br-md" : "rounded-bl-md"
              }`}
            />
            <Sk className="mt-1 h-2.5 w-10" />
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-end gap-2 pb-1 pt-2">
        <Sk className="h-11 flex-1 rounded-control" />
        <Sk className="h-11 w-11 shrink-0 rounded-control" />
      </div>
    </section>
  );
}
