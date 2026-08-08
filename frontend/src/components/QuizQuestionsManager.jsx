import React, { useState, useEffect, useCallback } from "react";
import {
  getQuizQuestionBank,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
} from "../lib/api";

export function QuizQuestionsManager({ days = [1, 2, 3], slots = [1, 2, 3] }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    question_text: "",
    section: "Technical",
    slot_day: "",
    slot_number: "",
    options: ["", "", "", ""],
    correct_answer_index: 0,
    is_active: 1,
  });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getQuizQuestionBank({
        slot_day: selectedDay,
        slot_number: selectedSlot,
      });
      setQuestions(res.questions || []);
    } catch (err) {
      setError(err.message || "Failed to load quiz questions.");
    } finally {
      setLoading(false);
    }
  }, [selectedDay, selectedSlot]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleOpenAddModal = () => {
    setEditingQuestion(null);
    setFormData({
      question_text: "",
      section: "Technical",
      slot_day: selectedDay || "",
      slot_number: selectedSlot || "",
      options: ["", "", "", ""],
      correct_answer_index: 0,
      is_active: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    const opts = Array.isArray(q.options)
      ? q.options.map((o) => (typeof o === "object" ? o.value : o))
      : ["", "", "", ""];

    while (opts.length < 4) opts.push("");

    setFormData({
      question_text: q.question_text || "",
      section: q.section || "General",
      slot_day: q.slot_day != null ? String(q.slot_day) : "",
      slot_number: q.slot_number != null ? String(q.slot_number) : "",
      options: opts,
      correct_answer_index: q.correct_answer_index ?? 0,
      is_active: q.is_active ?? 1,
    });
    setIsModalOpen(true);
  };

  const handleOptionChange = (index, value) => {
    const updated = [...formData.options];
    updated[index] = value;
    setFormData({ ...formData, options: updated });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validate options
    const validOpts = formData.options.map((o) => o.trim()).filter(Boolean);
    if (validOpts.length < 2) {
      setError("Please provide at least 2 valid options.");
      return;
    }

    try {
      const payload = {
        question_text: formData.question_text,
        section: formData.section,
        slot_day: formData.slot_day !== "" ? Number(formData.slot_day) : null,
        slot_number: formData.slot_number !== "" ? Number(formData.slot_number) : null,
        options: validOpts,
        correct_answer_index: Number(formData.correct_answer_index),
        is_active: Number(formData.is_active),
      };

      if (editingQuestion) {
        await updateQuizQuestion(editingQuestion.id, payload);
        setSuccessMsg("Question updated successfully!");
      } else {
        await addQuizQuestion(payload);
        setSuccessMsg("New question added successfully!");
      }

      setIsModalOpen(false);
      loadQuestions();
    } catch (err) {
      setError(err.message || "Failed to save question.");
    }
  };

  const handleDeleteConfirm = async (id) => {
    try {
      await deleteQuizQuestion(id);
      setSuccessMsg("Question deleted successfully.");
      setDeletingId(null);
      loadQuestions();
    } catch (err) {
      setError(err.message || "Failed to delete question.");
    }
  };

  // Filtered by local search query
  const filteredQuestions = questions.filter((q) => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      q.question_text?.toLowerCase().includes(term) ||
      q.section?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: "1.5rem", color: "#f8fafc" }}>
      {/* Header & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>
            Slot-Wise Quiz Questions
          </h2>
          <p style={{ margin: "0.25rem 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
            Manage slot-specific and fallback questions for candidates.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.625rem 1.25rem",
            fontWeight: "600",
            fontSize: "0.875rem",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
          }}
        >
          + Add New Question
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#86efac",
            marginBottom: "1rem",
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Filters Bar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
          backgroundColor: "#1e293b",
          padding: "1rem",
          borderRadius: "0.75rem",
          border: "1px solid #334155",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
            Filter by Day
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
            }}
          >
            <option value="">All Days</option>
            {days.map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: "200px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
            Filter by Time Slot
          </label>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
            }}
          >
            <option value="">All Slots</option>
            {slots.map((s) => (
              <option key={s} value={s}>
                Slot {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 2, minWidth: "250px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
            Search Questions
          </label>
          <input
            type="text"
            placeholder="Search by question text or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
            }}
          />
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
          Loading questions...
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            backgroundColor: "#1e293b",
            borderRadius: "0.75rem",
            border: "1px solid #334155",
            color: "#94a3b8",
          }}
        >
          No questions found for the selected filters.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredQuestions.map((q, idx) => (
            <div
              key={q.id || idx}
              style={{
                backgroundColor: "#1e293b",
                padding: "1.25rem",
                borderRadius: "0.75rem",
                border: "1px solid #334155",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "#334155",
                      color: "#e2e8f0",
                      fontWeight: "600",
                    }}
                  >
                    #{q.id}
                  </span>

                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(99, 102, 241, 0.2)",
                      color: "#a5b4fc",
                      fontWeight: "600",
                    }}
                  >
                    {q.section || "General"}
                  </span>

                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor:
                        q.slot_day != null && q.slot_number != null
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(245, 158, 11, 0.2)",
                      color:
                        q.slot_day != null && q.slot_number != null ? "#6ee7b7" : "#fcd34d",
                      fontWeight: "600",
                    }}
                  >
                    {q.slot_day != null && q.slot_number != null
                      ? `Day ${q.slot_day} - Slot ${q.slot_number}`
                      : "General / All Slots"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => handleOpenEditModal(q)}
                    style={{
                      background: "#334155",
                      color: "#f8fafc",
                      border: "none",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => setDeletingId(q.id)}
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "#fca5a5",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: "600", color: "#f8fafc" }}>
                {q.question_text}
              </h4>

              {/* Options */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
                {Array.isArray(q.options) &&
                  q.options.map((opt, oIdx) => {
                    const optVal = typeof opt === "object" ? opt.value : opt;
                    const isCorrect = oIdx === q.correct_answer_index;
                    return (
                      <div
                        key={oIdx}
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.375rem",
                          backgroundColor: isCorrect ? "rgba(34, 197, 94, 0.15)" : "#0f172a",
                          border: isCorrect ? "1px solid #22c55e" : "1px solid #1e293b",
                          fontSize: "0.875rem",
                          color: isCorrect ? "#86efac" : "#cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontWeight: "700", opacity: 0.7 }}>
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span>{optVal}</span>
                        {isCorrect && <span style={{ marginLeft: "auto", fontWeight: "bold" }}>✓</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Question Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              color: "#f8fafc",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>
              {editingQuestion ? "Edit Question" : "Add New Question"}
            </h3>

            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.25rem", color: "#94a3b8" }}>
                  Question Text *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#0f172a",
                    color: "#f8fafc",
                    border: "1px solid #334155",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#94a3b8" }}>
                    Section
                  </label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#94a3b8" }}>
                    Slot Day
                  </label>
                  <select
                    value={formData.slot_day}
                    onChange={(e) => setFormData({ ...formData, slot_day: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                    }}
                  >
                    <option value="">General (All Days)</option>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#94a3b8" }}>
                    Slot Number
                  </label>
                  <select
                    value={formData.slot_number}
                    onChange={(e) => setFormData({ ...formData, slot_number: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      backgroundColor: "#0f172a",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                    }}
                  >
                    <option value="">General (All Slots)</option>
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        Slot {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Options */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", color: "#94a3b8" }}>
                  Options & Correct Answer *
                </label>
                {formData.options.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={formData.correct_answer_index === idx}
                      onChange={() => setFormData({ ...formData, correct_answer_index: idx })}
                    />
                    <span style={{ fontWeight: "700", minWidth: "1.5rem" }}>
                      {String.fromCharCode(65 + idx)}:
                    </span>
                    <input
                      type="text"
                      required={idx < 2}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        borderRadius: "0.375rem",
                        backgroundColor: "#0f172a",
                        color: "#f8fafc",
                        border: "1px solid #334155",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#334155",
                    color: "#f8fafc",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {editingQuestion ? "Save Changes" : "Create Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "400px",
              padding: "1.5rem",
              color: "#f8fafc",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#fca5a5" }}>Delete Question</h3>
            <p style={{ color: "#cbd5e1" }}>
              Are you sure you want to delete this question? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#334155",
                  color: "#f8fafc",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingId)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  border: "none",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
