import Header from '@/components/Header';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Services from '@/components/Services';
import Brief from '@/components/Brief';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Brief />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
