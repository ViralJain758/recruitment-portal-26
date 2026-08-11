import db from "../config/db.js";
import crypto from "node:crypto";

const QUESTION_COUNT = Math.max(
  1,
  Number.parseInt(process.env.QUIZ_QUESTION_COUNT || "15", 10),
);

function seededNumber(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function paperSeed(slotDate, startTime) {
  const hash = crypto
    .createHash("sha256")
    .update(`${slotDate}:${startTime}`)
    .digest();

  return hash.readUInt32BE(0);
}

function shuffleForPaper(rows, slotDate, startTime) {
  const shuffled = [...rows];
  const random = seededNumber(paperSeed(slotDate, startTime));

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// Randomizes question order per candidate request. Unlike shuffleForPaper
// (which deterministically picks the same set of questions for everyone
// in a slot, keyed off the slot's date/time), this uses Math.random so
// every candidate sees their own question order even within the same slot.
function shuffleForCandidate(rows) {
  const shuffled = [...rows];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function stableSeed(key) {
  const hash = crypto.createHash("sha256").update(String(key)).digest();
  return hash.readUInt32BE(0);
}

// Deterministically shuffles a single question's options for a given
// candidate. Deterministic (rather than Math.random, like shuffleForCandidate
// above) on purpose: the candidate fetches questions once and answers by
// option index, then submits those indices later — scoring re-derives the
// canonical question set server-side from scratch, so it must land on the
// exact same option order for the exact same candidate+question, or indices
// picked against one order would be graded against another. Different
// candidates (different seedKey) still get independent, unpredictable
// option orders. correctAnswerIndex is remapped to follow the option it
// points to.
function shuffleOptionsForCandidate(options, correctAnswerIndex, seedKey) {
  if (!seedKey || !Array.isArray(options) || options.length < 2) {
    return { options, correctAnswerIndex };
  }

  const order = options.map((_, idx) => idx);
  const random = seededNumber(stableSeed(seedKey));

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const shuffledOptions = order.map((originalIndex) => options[originalIndex]);
  const shuffledCorrectAnswerIndex = order.indexOf(correctAnswerIndex);

  return { options: shuffledOptions, correctAnswerIndex: shuffledCorrectAnswerIndex };
}

export async function ensureQuizQuestionsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id          TEXT UNIQUE,
      section              TEXT NOT NULL DEFAULT 'General',
      question_text        TEXT NOT NULL,
      image_url            TEXT,
      options_json         TEXT NOT NULL,
      correct_answer_index INTEGER NOT NULL,
      display_order        INTEGER NOT NULL DEFAULT 0,
      is_active            INTEGER NOT NULL DEFAULT 1,
      slot_day             INTEGER,
      slot_number          INTEGER,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    await db.execute("ALTER TABLE quiz_questions ADD COLUMN slot_day INTEGER");
  } catch {}
  try {
    await db.execute("ALTER TABLE quiz_questions ADD COLUMN slot_number INTEGER");
  } catch {}

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_questions_active_order ON quiz_questions(is_active, display_order, id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_questions_slot ON quiz_questions(slot_day, slot_number, is_active)",
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_papers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_date   TEXT    NOT NULL,
      start_time  TEXT    NOT NULL,
      slot_day    INTEGER,
      slot_number INTEGER,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(slot_date, start_time)
    )
  `);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_papers_schedule ON quiz_papers(slot_date, start_time)",
  );

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_paper_questions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id       INTEGER NOT NULL REFERENCES quiz_papers(id) ON DELETE CASCADE,
      question_id    INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      question_order INTEGER NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(paper_id, question_id),
      UNIQUE(paper_id, question_order)
    )
  `);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_paper_questions_paper ON quiz_paper_questions(paper_id, question_order)",
  );

  // Incremental autosave — one row per (candidate, question), upserted as
  // the candidate answers so an answer sheet survives a lost connection,
  // a closed tab, or a device swap without waiting for final submission.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_autosave_answers (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id          INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
      question_external_id  TEXT NOT NULL,
      answer_index          INTEGER NOT NULL,
      updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(candidate_id, question_external_id)
    )
  `);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_quiz_autosave_candidate ON quiz_autosave_answers(candidate_id)",
  );
}

async function getCandidateSlotGroup(userId) {
  const result = await db.execute({
    sql: `SELECT s.slot_day, s.slot_number, s.slot_venue, d.slot_date, t.start_time
          FROM candidate_profiles cp
          LEFT JOIN candidate_status cs ON cs.candidate_id = cp.id
          LEFT JOIN slots s ON s.id = cs.slot_id
          LEFT JOIN slot_day_dates d ON d.day_number = s.slot_day
          LEFT JOIN slot_time_schedules t ON t.slot_number = s.slot_number
          WHERE cp.user_id = ?`,
    args: [userId],
  });

  const row = result.rows[0];

  return {
    slot_day: row?.slot_day || 1,
    slot_number: row?.slot_number || 1,
    slot_venue: row?.slot_venue || "Main Venue",
    slot_date: row?.slot_date || new Date().toISOString().split("T")[0],
    start_time: row?.start_time || "10:00 AM",
  };
}

async function fetchPaperQuestionRows(paperId) {
  const result = await db.execute({
    sql: `SELECT q.id, q.external_id, q.section, q.question_text, q.image_url, q.options_json, q.correct_answer_index, q.slot_day, q.slot_number
          FROM quiz_paper_questions pq
          JOIN quiz_questions q ON q.id = pq.question_id
          WHERE pq.paper_id = ?
            AND q.is_active = 1
          ORDER BY pq.question_order ASC`,
    args: [paperId],
  });

  return result.rows;
}

async function ensureQuizPaper(slot) {
  const slotDate = slot.slot_date || new Date().toISOString().split("T")[0];
  const startTime = slot.start_time || "10:00 AM";
  const slotDay = slot.slot_day || 1;
  const slotNumber = slot.slot_number || 1;

  await db.execute({
    sql: `INSERT INTO quiz_papers (slot_date, start_time, slot_day, slot_number)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(slot_date, start_time) DO UPDATE SET
            slot_day = excluded.slot_day,
            slot_number = excluded.slot_number`,
    args: [slotDate, startTime, slotDay, slotNumber],
  });

  const paperResult = await db.execute({
    sql: `SELECT id FROM quiz_papers WHERE slot_date = ? AND start_time = ?`,
    args: [slot.slot_date, slot.start_time],
  });
  const paper = paperResult.rows[0];

  if (!paper) {
    throw new Error("Could not create quiz paper for this slot.");
  }

  const existingRows = await fetchPaperQuestionRows(paper.id);
  if (existingRows.length > 0) return existingRows;

  const filterSlotDay = slot.slot_day != null ? Number(slot.slot_day) : null;
  const filterSlotNumber = slot.slot_number != null ? Number(slot.slot_number) : null;

  let activeResult;
  if (filterSlotDay != null && filterSlotNumber != null) {
    activeResult = await db.execute({
      sql: `SELECT id
            FROM quiz_questions
            WHERE is_active = 1
              AND (
                (slot_day = ? AND slot_number = ?)
                OR (slot_day IS NULL AND slot_number IS NULL)
              )
            ORDER BY
              CASE WHEN slot_day IS NOT NULL AND slot_number IS NOT NULL THEN 0 ELSE 1 END ASC,
              display_order ASC, id ASC`,
      args: [filterSlotDay, filterSlotNumber],
    });
  } else {
    activeResult = await db.execute({
      sql: `SELECT id
            FROM quiz_questions
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC`,
      args: [],
    });
  }

  const activeQuestions = activeResult.rows;
  if (activeQuestions.length === 0) {
    throw new Error("No active quiz questions are available in the database.");
  }

  const selectedQuestions = shuffleForPaper(
    activeQuestions,
    slot.slot_date,
    slot.start_time,
  ).slice(0, Math.min(QUESTION_COUNT, activeQuestions.length));

  await db.batch(
    selectedQuestions.map((question, index) => ({
      sql: `INSERT OR IGNORE INTO quiz_paper_questions
            (paper_id, question_id, question_order)
            VALUES (?, ?, ?)`,
      args: [paper.id, question.id, index + 1],
    })),
    "write",
  );

  return fetchPaperQuestionRows(paper.id);
}

// seedId, when provided, deterministically shuffles each question's
// options for that candidate (see shuffleOptionsForCandidate above).
// Omitted for admin/management call sites, which need the options in their
// original stored order.
function mapQuestionRows(resultRows, seedId) {
  return resultRows.map((row) => {
    const options = JSON.parse(row.options_json);

    if (!Array.isArray(options) || options.length === 0) {
      throw new Error(`Quiz question ${row.external_id || row.id} has invalid options.`);
    }

    const questionId = row.external_id || `db-${row.id}`;
    const baseCorrectAnswerIndex = Number(row.correct_answer_index ?? 0);
    const { options: finalOptions, correctAnswerIndex } = shuffleOptionsForCandidate(
      options,
      baseCorrectAnswerIndex,
      seedId ? `${seedId}:${questionId}` : null,
    );

    return {
      id: questionId,
      section: row.section,
      text: row.question_text,
      imageUrl: row.image_url || "",
      correctAnswerIndex,
      options: finalOptions,
    };
  });
}

// Candidate-facing variant — MUST NOT leak the correct answer index. The
// client only needs enough to render the question and record a selection.
function mapQuestionRowsForCandidate(resultRows, seedId) {
  return mapQuestionRows(resultRows, seedId).map(({ correctAnswerIndex: _drop, ...safeQuestion }) => safeQuestion);
}

export async function fetchQuizQuestionsForUser(userId) {
  const quizRow = await db.execute({
    sql: `SELECT cq.quiz_submitted_at
          FROM candidate_quiz cq
          JOIN candidate_profiles cp ON cp.id = cq.candidate_id
          WHERE cp.user_id = ?`,
    args: [userId],
  });

  if (quizRow.rows[0]?.quiz_submitted_at) {
    throw new Error("This quiz has already been submitted.");
  }

  const slot = await getCandidateSlotGroup(userId);

  if (!slot) {
    throw new Error("No quiz slot is assigned to this candidate.");
  }

  const rows = await ensureQuizPaper(slot);

  // Any answers autosaved from a previous session (lost connection, closed
  // tab, different device) get handed back alongside the questions so the
  // client can merge them into its local answer sheet on load, instead of
  // only relying on this browser's own localStorage.
  const savedResponses = await fetchAutosavedAnswersForUser(userId);

  return {
    slot: {
      day: slot.slot_day,
      number: slot.slot_number,
      date: slot.slot_date,
      time: slot.start_time,
    },
    questions: shuffleForCandidate(mapQuestionRowsForCandidate(rows, userId)),
    savedResponses,
  };
}

async function getCandidateIdForUser(userId) {
  const profileResult = await db.execute({
    sql: `SELECT id FROM candidate_profiles WHERE user_id = ?`,
    args: [userId],
  });

  return profileResult.rows[0]?.id || null;
}

// Returns { [questionExternalId]: answerIndex } for everything this
// candidate has autosaved so far.
export async function fetchAutosavedAnswersForUser(userId) {
  const candidateId = await getCandidateIdForUser(userId);
  if (!candidateId) return {};

  const result = await db.execute({
    sql: `SELECT question_external_id, answer_index
          FROM quiz_autosave_answers
          WHERE candidate_id = ?`,
    args: [candidateId],
  });

  const savedResponses = {};
  for (const row of result.rows) {
    savedResponses[row.question_external_id] = Number(row.answer_index);
  }
  return savedResponses;
}

// Upserts a batch of in-progress answers for a candidate who hasn't
// submitted yet. Silently ignores malformed entries rather than failing
// the whole batch — a single bad key shouldn't block the rest of the
// candidate's answers from being saved.
export async function autosaveQuizAnswersForUser(userId, responses = {}) {
  const candidateId = await getCandidateIdForUser(userId);
  if (!candidateId) {
    throw new Error("Candidate not found.");
  }

  const quizResult = await db.execute({
    sql: `SELECT quiz_submitted_at FROM candidate_quiz WHERE candidate_id = ?`,
    args: [candidateId],
  });

  if (quizResult.rows[0]?.quiz_submitted_at) {
    // Not an error — the client's background sync may fire once more right
    // after final submission goes through. Just report nothing was saved.
    return { saved: 0 };
  }

  const responseMap = responses && typeof responses === "object" ? responses : {};
  const entries = Object.entries(responseMap).filter(([questionId, answerIndex]) => {
    return (
      typeof questionId === "string" &&
      questionId.length > 0 &&
      questionId.length <= 200 &&
      Number.isInteger(Number(answerIndex)) &&
      Number(answerIndex) >= 0
    );
  });

  if (entries.length === 0) return { saved: 0 };

  await db.batch(
    entries.map(([questionId, answerIndex]) => ({
      sql: `INSERT INTO quiz_autosave_answers (candidate_id, question_external_id, answer_index, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(candidate_id, question_external_id) DO UPDATE SET
              answer_index = excluded.answer_index,
              updated_at = datetime('now')`,
      args: [candidateId, questionId, Number(answerIndex)],
    })),
    "write",
  );

  return { saved: entries.length };
}

export async function submitQuizForUser(userId, responses = {}) {
  const profileResult = await db.execute({
    sql: `SELECT id FROM candidate_profiles WHERE user_id = ?`,
    args: [userId],
  });

  const candidateId = profileResult.rows[0]?.id;
  if (!candidateId) {
    throw new Error("Candidate not found.");
  }

  const quizResult = await db.execute({
    sql: `SELECT quiz_submitted_at FROM candidate_quiz WHERE candidate_id = ?`,
    args: [candidateId],
  });

  if (quizResult.rows[0]?.quiz_submitted_at) {
    throw new Error("This quiz has already been submitted.");
  }

  // Re-derive the candidate's own slot/paper server-side — never trust a
  // "questions" array from the client, since it could be tampered with to
  // include a forged answer key.
  const slot = await getCandidateSlotGroup(userId);
  if (!slot) {
    throw new Error("No quiz slot is assigned to this candidate.");
  }

  const paperRows = await ensureQuizPaper(slot);
  const canonicalQuestions = mapQuestionRows(paperRows, userId); // includes correctAnswerIndex, server-side only

  const responseMap = responses && typeof responses === "object" ? responses : {};

  let score = 0;
  canonicalQuestions.forEach((question) => {
    const selectedAnswer = responseMap[question.id];
    if (selectedAnswer !== undefined && Number(selectedAnswer) === question.correctAnswerIndex) {
      score += 1;
    }
  });

  await db.execute({
    sql: `INSERT INTO candidate_quiz (candidate_id, quiz_attended, quiz_score, quiz_submitted_at, quiz_attempt_count, updated_at)
          VALUES (?, 1, ?, ?, 1, datetime('now'))
          ON CONFLICT(candidate_id) DO UPDATE SET
            quiz_attended = 1,
            quiz_score = excluded.quiz_score,
            quiz_submitted_at = excluded.quiz_submitted_at,
            quiz_attempt_count = COALESCE(candidate_quiz.quiz_attempt_count, 0) + 1,
            updated_at = datetime('now')`,
    args: [candidateId, score, new Date().toISOString()],
  });

  // Autosave rows have done their job once the real submission lands —
  // clear them so they don't linger indefinitely.
  await db
    .execute({
      sql: `DELETE FROM quiz_autosave_answers WHERE candidate_id = ?`,
      args: [candidateId],
    })
    .catch(() => {});

  return {
    score,
    totalQuestions: canonicalQuestions.length,
    submitted: true,
  };
}

export async function fetchActiveQuizQuestions() {
  const result = await db.execute({
    sql: `SELECT id, external_id, section, question_text, image_url, options_json
          FROM quiz_questions
          WHERE is_active = 1
          ORDER BY display_order ASC, id ASC`,
    args: [],
  });

  return mapQuestionRows(result.rows);
}

function normalizeOptionInput(option) {
  if (typeof option === "string") {
    return { type: "text", value: option };
  }

  if (option && typeof option === "object") {
    const optionType = String(option.type || option.kind || "").toLowerCase();

    if (optionType === "image") {
      return {
        type: "image",
        value: option.value ?? option.imageUrl ?? option.src ?? option.url ?? "",
      };
    }

    return {
      type: "text",
      value: option.text ?? option.label ?? option.value ?? option.content ?? "",
    };
  }

  return { type: "text", value: "" };
}

function parseOptions(options) {
  if (Array.isArray(options)) {
    return options
      .map((option) => normalizeOptionInput(option))
      .filter((option) => option.value !== "" && option.value !== null && option.value !== undefined);
  }

  if (typeof options !== "string") return [];

  try {
    const parsed = JSON.parse(options);
    if (Array.isArray(parsed)) {
      return parsed
        .map((option) => normalizeOptionInput(option))
        .filter((option) => option.value !== "" && option.value !== null && option.value !== undefined);
    }
  } catch {
    // fall through to newline splitting for legacy plain text options
  }

  return options
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => normalizeOptionInput(option));
}

function parseActiveFlag(value) {
  if (value === undefined || value === null) return 1;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 0 ? 0 : 1;
  if (typeof value === "string") {
    return ["0", "false", "inactive", "no"].includes(value.toLowerCase()) ? 0 : 1;
  }
  return value ? 1 : 0;
}

function normalizeQuestionInput(question, index) {
  const options = parseOptions(question.options ?? question.options_json);
  const correctAnswerIndex = Number(
    question.correct_answer_index ?? question.correctAnswerIndex,
  );
  const displayOrder = Number.parseInt(
    question.display_order ?? question.displayOrder ?? index + 1,
    10,
  );

  if (!question.question_text && !question.text) {
    throw new Error(`Question ${index + 1} is missing question text.`);
  }

  if (options.length < 2) {
    throw new Error(`Question ${index + 1} must have at least two options.`);
  }

  if (
    !Number.isInteger(correctAnswerIndex) ||
    correctAnswerIndex < 0 ||
    correctAnswerIndex >= options.length
  ) {
    throw new Error(`Question ${index + 1} has an invalid correct answer index.`);
  }

  const slotDay = question.slot_day != null && question.slot_day !== "" ? Number(question.slot_day) : (question.slotDay != null && question.slotDay !== "" ? Number(question.slotDay) : null);
  const slotNumber = question.slot_number != null && question.slot_number !== "" ? Number(question.slot_number) : (question.slotNumber != null && question.slotNumber !== "" ? Number(question.slotNumber) : null);

  return {
    externalId:
      question.external_id ||
      question.externalId ||
      `question-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    section: question.section || "General",
    questionText: question.question_text || question.text,
    imageUrl: question.image_url || question.imageUrl || null,
    optionsJson: JSON.stringify(options),
    correctAnswerIndex,
    displayOrder: Number.isInteger(displayOrder) ? displayOrder : index + 1,
    isActive: parseActiveFlag(question.is_active ?? question.isActive),
    slotDay: Number.isInteger(slotDay) ? slotDay : null,
    slotNumber: Number.isInteger(slotNumber) ? slotNumber : null,
  };
}

export async function listQuizQuestionBank(filters = {}) {
  const { slot_day, slot_number } = filters;
  const whereClauses = [];
  const args = [];

  if (slot_day !== undefined && slot_day !== null && slot_day !== "") {
    whereClauses.push("slot_day = ?");
    args.push(Number(slot_day));
  }

  if (slot_number !== undefined && slot_number !== null && slot_number !== "") {
    whereClauses.push("slot_number = ?");
    args.push(Number(slot_number));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const result = await db.execute({
    sql: `SELECT id, external_id, section, question_text, image_url, options_json,
                 correct_answer_index, display_order, is_active, slot_day, slot_number,
                 created_at, updated_at
          FROM quiz_questions
          ${whereSql}
          ORDER BY slot_day ASC, slot_number ASC, display_order ASC, id ASC`,
    args,
  });

  return result.rows.map((row) => {
    let options = [];
    if (row.options_json) {
      try {
        options = typeof row.options_json === "string" ? JSON.parse(row.options_json) : row.options_json;
      } catch {
        options = [];
      }
    }
    return {
      ...row,
      options: Array.isArray(options) ? options : [],
    };
  });
}

export async function createQuizQuestion(questionData) {
  const normalized = normalizeQuestionInput(questionData, 0);

  const result = await db.execute({
    sql: `INSERT INTO quiz_questions
          (external_id, section, question_text, image_url, options_json, correct_answer_index, display_order, is_active, slot_day, slot_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      normalized.externalId,
      normalized.section,
      normalized.questionText,
      normalized.imageUrl,
      normalized.optionsJson,
      normalized.correctAnswerIndex,
      normalized.displayOrder,
      normalized.isActive,
      normalized.slotDay,
      normalized.slotNumber,
    ],
  });

  await db.execute("DELETE FROM quiz_paper_questions");
  await db.execute("DELETE FROM quiz_papers");

  const createdId = Number(result.lastInsertRowid);
  const rows = await listQuizQuestionBank();
  return rows.find((q) => q.id === createdId) || rows[0];
}

export async function updateQuizQuestion(id, questionData) {
  const normalized = normalizeQuestionInput(questionData, 0);

  await db.execute({
    sql: `UPDATE quiz_questions
          SET section = ?,
              question_text = ?,
              image_url = ?,
              options_json = ?,
              correct_answer_index = ?,
              display_order = ?,
              is_active = ?,
              slot_day = ?,
              slot_number = ?,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      normalized.section,
      normalized.questionText,
      normalized.imageUrl,
      normalized.optionsJson,
      normalized.correctAnswerIndex,
      normalized.displayOrder,
      normalized.isActive,
      normalized.slotDay,
      normalized.slotNumber,
      id,
    ],
  });

  await db.execute("DELETE FROM quiz_paper_questions");
  await db.execute("DELETE FROM quiz_papers");

  const rows = await listQuizQuestionBank();
  return rows.find((q) => q.id === Number(id));
}

export async function deleteQuizQuestion(id) {
  await db.execute({
    sql: `DELETE FROM quiz_questions WHERE id = ?`,
    args: [id],
  });

  await db.execute("DELETE FROM quiz_paper_questions");
  await db.execute("DELETE FROM quiz_papers");

  return { success: true, deletedId: Number(id) };
}

export async function upsertQuizQuestionBank(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Provide at least one question.");
  }

  const rows = questions.map(normalizeQuestionInput);

  await db.batch(
    rows.map((question) => ({
      sql: `INSERT INTO quiz_questions
            (external_id, section, question_text, image_url, options_json, correct_answer_index, display_order, is_active, slot_day, slot_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(external_id) DO UPDATE SET
              section = excluded.section,
              question_text = excluded.question_text,
              image_url = excluded.image_url,
              options_json = excluded.options_json,
              correct_answer_index = excluded.correct_answer_index,
              display_order = excluded.display_order,
              is_active = excluded.is_active,
              slot_day = excluded.slot_day,
              slot_number = excluded.slot_number,
              updated_at = datetime('now')`,
      args: [
        question.externalId,
        question.section,
        question.questionText,
        question.imageUrl,
        question.optionsJson,
        question.correctAnswerIndex,
        question.displayOrder,
        question.isActive,
        question.slotDay,
        question.slotNumber,
      ],
    })),
    "write",
  );

  await db.execute("DELETE FROM quiz_paper_questions");
  await db.execute("DELETE FROM quiz_papers");

  return listQuizQuestionBank();
}
