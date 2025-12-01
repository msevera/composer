'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles, Shield, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ComposerAIDemo from '@/components/ComposerAIDemo';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden selection:bg-blue-500/30">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500/5 via-gray-950 to-violet-500/5 pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            {/* <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div> */}
            <span className="text-xl font-semibold text-white">Composer AI</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden md:flex items-center gap-8"
          >
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How it works</a>
            <a href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors">Testimonials</a>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="space-y-8"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50 text-sm font-medium">
                <Zap className="w-4 h-4" />
                AI-Powered Email Assistant
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight"
            >
              Draft perfect emails
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                in seconds
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
            >
              Composer AI understands context, matches your tone, and crafts thoughtful replies instantly.
              Spend less time typing, more time doing what matters.
            </motion.p>

            <motion.div variants={fadeUp} className="pt-4">
              <Button
                size="lg"
                className="h-14 px-8 text-base font-medium bg-white hover:bg-gray-100 text-gray-900 border border-transparent shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all duration-300 rounded-full group"
                onClick={() => {
                  const webUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/login`;
                  if (webUrl) {
                    window.location.href = webUrl;
                  }
                }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-3">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Start with Gmail
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <p className="text-sm text-gray-500 mt-4">Free • No credit card required</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating UI Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="max-w-4xl mx-auto mt-16 md:mt-24"
        >
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-50" />
            <div className="relative bg-gray-900 rounded-2xl shadow-2xl shadow-black/50 border border-gray-800 overflow-hidden">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-gray-800 rounded-lg text-xs text-gray-500 border border-gray-700/50">
                    mail.google.com
                  </div>
                </div>
              </div>

              {/* Email Interface Mock */}
              <div className="flex p-6 md:p-8 h-[542px]">
                <div className="flex flex-1 items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-white font-medium text-sm shrink-0 shadow-lg shadow-orange-900/20">
                    JD
                  </div>
                  <div className="flex flex-col flex-1 h-full">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-200">John Doe</span>
                        <span className="text-xs text-gray-500">2 min ago</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">
                        Hi, I wanted to follow up on our meeting yesterday. Could you send me the project timeline we discussed?
                      </p>
                    </div>
                    <div className="flex-1">
                      <ComposerAIDemo />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-5xl font-bold text-white mb-4"
            >
              Why Composer AI?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-gray-400 max-w-xl mx-auto"
            >
              Everything you need to handle emails effortlessly
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6 md:gap-8"
          >
            {[
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Generate thoughtful replies in under 3 seconds. No more staring at a blank screen.",
                gradient: "from-amber-500 to-orange-600"
              },
              {
                icon: Shield,
                title: "Privacy First",
                description: "Your emails stay yours. We never store or train on your personal data.",
                gradient: "from-emerald-500 to-teal-600"
              },
              {
                icon: Sparkles,
                title: "Context Aware",
                description: "AI that understands the full conversation thread and responds appropriately.",
                gradient: "from-blue-500 to-violet-600"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                className="group p-8 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 px-6 py-24 md:py-32 border-y border-gray-900 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-5xl font-bold text-white mb-4"
            >
              Effortless Workflow
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-gray-400 max-w-xl mx-auto"
            >
              Get started in minutes, save hours every week
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="space-y-6"
          >
            {[
              { step: "01", title: "Connect Gmail", description: "One-click authorization. We only request the permissions we need." },
              { step: "02", title: "Open any email", description: "Composer AI appears right in your inbox when you need it." },
              { step: "03", title: "Click & send", description: "Review the AI draft, make any tweaks, and hit send." }
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                className="flex items-center gap-6 md:gap-8 p-6 md:p-8 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
                  <span className="text-xl font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-gray-400">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-5xl font-bold text-white mb-4"
            >
              Loved by professionals
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-gray-400 max-w-xl mx-auto"
            >
              Join professionals who&apos;ve transformed their email workflow
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              { name: "Sarah Chen", role: "Product Manager", quote: "I used to spend 2 hours on emails daily. Now it's 20 minutes. Composer AI is genuinely life-changing.", avatar: "SC" },
              { name: "Marcus Webb", role: "Startup Founder", quote: "The tone matching is incredible. My team can't tell which emails I wrote vs which Composer helped with.", avatar: "MW" },
              { name: "Elena Rodriguez", role: "Sales Director", quote: "Response rate up 40% since using Composer. The AI knows exactly how to phrase follow-ups.", avatar: "ER" }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                className="p-6 md:p-8 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-blue-900/20">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{testimonial.name}</p>
                    <p className="text-gray-500 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="space-y-8"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-5xl font-bold text-white"
            >
              Ready to transform
              <br />
              your inbox?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-gray-400 max-w-lg mx-auto"
            >
              Join professionals who reply to emails 10x faster with Composer AI
            </motion.p>
            <motion.div variants={fadeUp}>
              <Button
                size="lg"
                className="h-14 px-8 text-base font-medium bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.4)] transition-all duration-300 rounded-full group"
                onClick={() => {
                  const webUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/login`;
                  if (webUrl) {
                    window.location.href = webUrl;
                  }
                }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-3">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Start with Gmail
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-8 pt-4">
              {[
                { icon: CheckCircle2, text: "Free" },
                { icon: CheckCircle2, text: "No credit card" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-400">
                  <item.icon className="w-4 h-4 text-green-500" />
                  {item.text}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-gray-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">            
            <span className="font-semibold text-white">Composer AI</span>
          </div>
          <div className="flex items-center gap-6">
            <a 
              href={`${process.env.NEXT_PUBLIC_WEB_URL || ''}/privacy-policy`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a 
              href={`${process.env.NEXT_PUBLIC_WEB_URL || ''}/terms-of-use`}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Terms of Use
            </a>
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Composer AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}