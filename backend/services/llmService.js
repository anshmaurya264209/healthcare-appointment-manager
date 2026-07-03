const axios = require('axios');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Low-level call to Groq's OpenAI-compatible chat completions endpoint.
 * Throws on failure - callers are responsible for graceful degradation.
 */
async function callGroq(systemPrompt, userPrompt, { jsonMode = true, timeoutMs = 15000 } = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const body = {
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 700,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const { data } = await axios.post(GROQ_API_URL, body, {
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: timeoutMs,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');
  return content;
}

/**
 * Pre-visit summary. Prompt per assignment spec:
 * "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint,
 *  and three suggested questions for the doctor. Symptoms: <symptoms>"
 */
async function generatePreVisitSummary(symptoms) {
  const systemPrompt =
    'You are a clinical intake assistant. You never diagnose. You output STRICT JSON only, matching this shape: ' +
    '{"urgency": "Low|Medium|High", "chiefComplaint": "string", "suggestedQuestions": ["q1","q2","q3"]}. ' +
    'Base urgency on symptom severity/red flags described by the patient. Keep chiefComplaint to one sentence.';

  const userPrompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;

  try {
    const raw = await callGroq(systemPrompt, userPrompt, { jsonMode: true });
    const parsed = JSON.parse(raw);
    return {
      urgency: ['Low', 'Medium', 'High'].includes(parsed.urgency) ? parsed.urgency : 'Medium',
      chiefComplaint: parsed.chiefComplaint || '',
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
      raw,
      generatedAt: new Date(),
      failed: false,
    };
  } catch (err) {
    console.error('LLM pre-visit summary failed:', err.message);
    // Graceful degradation: never block the booking flow because the LLM is down.
    return {
      urgency: 'Medium',
      chiefComplaint: symptoms ? symptoms.slice(0, 140) : 'Not summarised (AI unavailable)',
      suggestedQuestions: [],
      raw: '',
      generatedAt: new Date(),
      failed: true,
    };
  }
}

/**
 * Post-visit summary. Prompt per assignment spec:
 * "Convert these clinical notes into a patient-friendly summary with medication schedule
 *  and follow-up steps: <notes>"
 */
async function generatePostVisitSummary(notes, prescription = []) {
  const systemPrompt =
    'You are a patient-friendly medical writer. Avoid jargon. You output STRICT JSON only, matching this shape: ' +
    '{"summaryText": "string", "medicationSchedule": "string", "followUpSteps": "string"}. ' +
    'medicationSchedule should be a plain-language, easy-to-follow reading of the prescription list provided.';

  const prescriptionText = prescription
    .map((p) => `${p.medicine} ${p.dosage}, ${p.frequency}, for ${p.durationDays} days. ${p.instructions || ''}`)
    .join('; ');

  const userPrompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}\n\nPrescription: ${
    prescriptionText || 'None'
  }`;

  try {
    const raw = await callGroq(systemPrompt, userPrompt, { jsonMode: true });
    const parsed = JSON.parse(raw);
    return {
      summaryText: parsed.summaryText || '',
      medicationSchedule: parsed.medicationSchedule || '',
      followUpSteps: parsed.followUpSteps || '',
      raw,
      generatedAt: new Date(),
      failed: false,
    };
  } catch (err) {
    console.error('LLM post-visit summary failed:', err.message);
    return {
      summaryText: notes ? notes.slice(0, 300) : 'Summary unavailable (AI service error). Please contact the clinic.',
      medicationSchedule: prescriptionText || 'See prescription details provided by your doctor.',
      followUpSteps: 'Please follow up with the clinic if symptoms persist or worsen.',
      raw: '',
      generatedAt: new Date(),
      failed: true,
    };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
