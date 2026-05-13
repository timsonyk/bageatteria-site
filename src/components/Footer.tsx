import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#F2F2F7] mt-12">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[13px] text-[#8E8E93]">
        <div className="flex flex-col gap-1">
          <span className="text-black font-medium">Bageatteria</span>
          <span>
            ООО «БАГЕТТЕРИЯ» · ИНН 9704158488
          </span>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-black transition-colors">
            Политика конфиденциальности
          </Link>
        </nav>

        <span className="text-[12px]">
          © {new Date().getFullYear()} Bageatteria
        </span>
      </div>
    </footer>
  );
}
