"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div>
      <PageHeader
        title="Contact"
        subtitle="Questions about an order, fit, or fabric — we usually respond within one business day."
      />
      <div className="mx-auto grid max-w-content grid-cols-1 gap-16 px-5 pb-28 md:grid-cols-[1fr_1.2fr] md:px-10">
        <div className="flex flex-col gap-6 text-sm text-graphite">
          <div className="flex items-center gap-3">
            <Mail size={16} strokeWidth={1.5} className="text-ash" />
            <a href="mailto:hello@nsude.com" className="hover:text-ink">
              hello@nsude.com
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={16} strokeWidth={1.5} className="text-ash" />
            <span>+91 98765 43210</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin size={16} strokeWidth={1.5} className="text-ash" />
            <span>Studio 4B, Mumbai, India</span>
          </div>
        </div>

        {sent ? (
          <p className="text-sm text-graphite" role="status">
            Thank you — your message has been sent. We&apos;ll be in touch shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
                  Name
                </label>
                <input
                  id="name"
                  required
                  className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="h-12 w-full border border-graphite/20 bg-transparent px-3 text-sm focus:border-ink focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="message" className="mb-2 block text-xs uppercase tracking-widest2 text-ash">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={5}
                className="w-full resize-none border border-graphite/20 bg-transparent px-3 py-3 text-sm focus:border-ink focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="group flex h-14 w-full items-center justify-center gap-2 bg-ink text-sm uppercase tracking-widest2 text-bone transition-colors hover:bg-graphite sm:w-fit sm:px-10"
            >
              Send Message
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
