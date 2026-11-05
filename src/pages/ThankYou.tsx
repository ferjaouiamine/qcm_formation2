import { useEffect } from "react";
import { RESULT_KEY } from "../lib/storage";

export function ThankYou() {
  useEffect(() => {
    localStorage.removeItem(RESULT_KEY);
    sessionStorage.removeItem("qcm-result");
  }, []);
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="card w-full max-w-xl px-6 py-14 text-center sm:px-10">
        <h1 className="text-3xl font-extrabold leading-tight text-[#102d4e] sm:text-4xl">
          Merci pour votre participation
        </h1>
      </section>
    </main>
  );
}
