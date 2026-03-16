<script setup>
import { ref } from 'vue'

const FORM_ID = '3j7JB'

const name = ref('')
const email = ref('')
const subject = ref('')
const message = ref('')
const loading = ref(false)
const succeeded = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
    error.value = 'Veuillez remplir tous les champs obligatoires.'
    return
  }

  loading.value = true
  error.value = ''
  succeeded.value = false

  try {
    await fetch(`https://formbold.com/s/${FORM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        subject: subject.value,
        message: message.value,
      }),
    })
    succeeded.value = true
    name.value = ''
    email.value = ''
    subject.value = ''
    message.value = ''
  } catch (err) {
    error.value = 'Une erreur est survenue. Veuillez réessayer.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="contact-form">
    <div v-if="succeeded" class="contact-form__success">
      <p>Votre message a bien été envoyé. Nous vous répondrons dans les meilleurs délais.</p>
      <p><em>Your message has been sent. We will get back to you as soon as possible.</em></p>
      <button class="contact-form__btn" @click="succeeded = false">
        Envoyer un autre message
      </button>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="contact-form__form">
      <div class="contact-form__field">
        <label for="contact-name">Nom / Name *</label>
        <input
          id="contact-name"
          v-model="name"
          type="text"
          required
          placeholder="Jean Dupont"
        />
      </div>

      <div class="contact-form__field">
        <label for="contact-email">Email *</label>
        <input
          id="contact-email"
          v-model="email"
          type="email"
          required
          placeholder="jean@exemple.com"
        />
      </div>

      <div class="contact-form__field">
        <label for="contact-subject">Sujet / Subject</label>
        <input
          id="contact-subject"
          v-model="subject"
          type="text"
          placeholder="Bug report, question, suggestion..."
        />
      </div>

      <div class="contact-form__field">
        <label for="contact-message">Message *</label>
        <textarea
          id="contact-message"
          v-model="message"
          required
          rows="5"
          placeholder="Décrivez votre problème ou votre question..."
        ></textarea>
      </div>

      <p v-if="error" class="contact-form__error">{{ error }}</p>

      <button
        type="submit"
        class="contact-form__btn"
        :disabled="loading"
      >
        {{ loading ? 'Envoi en cours...' : 'Envoyer / Send' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.contact-form {
  max-width: 520px;
}

.contact-form__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.contact-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-form__field label {
  font-weight: 500;
  font-size: 0.9em;
}

.contact-form__field input,
.contact-form__field textarea {
  padding: 8px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.9em;
  font-family: inherit;
  transition: border-color 0.2s;
}

.contact-form__field input:focus,
.contact-form__field textarea:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.contact-form__field textarea {
  resize: vertical;
  min-height: 100px;
}

.contact-form__btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  align-self: flex-start;
}

.contact-form__btn:hover {
  opacity: 0.9;
}

.contact-form__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contact-form__error {
  color: var(--vp-c-danger-1);
  font-size: 0.85em;
  margin: 0;
}

.contact-form__success {
  padding: 16px;
  border-radius: 8px;
  background: var(--vp-c-green-soft);
  border: 1px solid var(--vp-c-green-2);
}

.contact-form__success p {
  margin: 0 0 8px;
}

.contact-form__success p:last-of-type {
  margin-bottom: 12px;
}
</style>
