import { ChevronDown } from 'lucide-react'
import { FREQUENTLY_ASKED_QUESTIONS } from '@/content/frequently-asked-questions'

export function FaqSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-24 md:grid-cols-[1fr_1.4fr]">
        <h2 className="text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[48px]">
          Frequently
          <br />
          asked questions
        </h2>
        <div className="divide-y divide-line">
          {FREQUENTLY_ASKED_QUESTIONS.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 pr-10 text-[15px] leading-6 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
