'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

export default function ContactForm() {
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [envoye, setEnvoye] = useState(false);

  const fieldClassName =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Aucune donnée n'est envoyée ni stockée – pure démonstration
    setEnvoye(true);
  };

  return (
    <section id="contact" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-blue-950 sm:text-4xl">
          Demande de devis
        </h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
          <div className="rounded-2xl bg-blue-950 p-8 text-white">
            <h3 className="text-lg font-semibold">Coordonnées</h3>
            <div className="mt-6 space-y-5">
              <div>
                <span className="block text-sm font-medium text-blue-300">Téléphone</span>
                <a
                  href="tel:0596711010"
                  className="mt-1 block text-lg font-medium text-white underline-offset-4 hover:underline"
                >
                  05 96 71 10 10
                </a>
              </div>
              <div>
                <span className="block text-sm font-medium text-blue-300">Adresse</span>
                <p className="mt-1 text-blue-100">
                  28 Boulevard Nelson Mandela Léon Laouchez-Espace Anita
                  <br />
                  97200 Fort-de-France
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            {envoye ? (
              <p role="status" aria-live="polite" className="text-center text-green-600">
                Démonstration Magic Script : ce formulaire n’envoie actuellement aucune donnée.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nom" className="mb-2 block text-sm font-medium text-slate-700">
                      Nom
                    </label>
                    <input
                      id="nom"
                      type="text"
                      autoComplete="name"
                      required
                      className={fieldClassName}
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="telephone" className="mb-2 block text-sm font-medium text-slate-700">
                      Téléphone
                    </label>
                    <input
                      id="telephone"
                      type="tel"
                      autoComplete="tel"
                      required
                      className={fieldClassName}
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={fieldClassName}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                    Description du besoin
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    required
                    className={fieldClassName}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
                  >
                    Demander un devis
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
