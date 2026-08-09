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
    image_url: "",
  });
  const [imageError, setImageError] = useState(null);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);

  const handleImageUrlChange = (value) => {
    setImageError(null);
    setImagePreviewFailed(false);
    setFormData((prev) => ({ ...prev, image_url: value }));
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: "" }));
    setImageError(null);
    setImagePreviewFailed(false);
  };

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
    setImageError(null);
    setImagePreviewFailed(false);
    setFormData({
      question_text: "",
      section: "Technical",
      slot_day: selectedDay || "",
      slot_number: selectedSlot || "",
      options: ["", "", "", ""],
      correct_answer_index: 0,
      is_active: 1,
      image_url: "",
    });
    setIsModalOpen(true);
  };

function getSafeOptionsArray(rawOptions) {
  if (Array.isArray(rawOptions)) return rawOptions;
  if (typeof rawOptions === "string") {
    try {
      const parsed = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    setImageError(null);
    setImagePreviewFailed(false);
    const rawOpts = getSafeOptionsArray(q.options || q.options_json);
    const opts = rawOpts.map((o) => (typeof o === "object" ? o.value : String(o ?? "")));

    while (opts.length < 4) opts.push("");

    setFormData({
      question_text: q.question_text || "",
      section: q.section || "General",
      slot_day: q.slot_day != null ? String(q.slot_day) : "",
      slot_number: q.slot_number != null ? String(q.slot_number) : "",
      options: opts,
      correct_answer_index: q.correct_answer_index ?? 0,
      is_active: q.is_active ?? 1,
      image_url: q.image_url || q.imageUrl || "",
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
        image_url: formData.image_url ? formData.image_url.trim() : null,
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
    <div className="qm-wrap">
      {/* Header & Controls */}
      <div className="qm-header">
        <div>
          <h2>Slot-Wise Quiz Questions</h2>
          <p>Manage slot-specific and fallback questions for candidates.</p>
        </div>

        <button className="btn btn--primary" onClick={handleOpenAddModal}>
          + Add New Question
        </button>
      </div>

      {/* Alerts */}
      {error && <div className="qm-alert qm-alert--error">{error}</div>}
      {successMsg && <div className="qm-alert qm-alert--success">{successMsg}</div>}

      {/* Filters Bar */}
      <div className="qm-toolbar">
        <div className="qm-field qm-field--select">
          <label>Filter by Day</label>
          <select
            className="qm-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            <option value="">All Days</option>
            {days.map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
        </div>

        <div className="qm-field qm-field--select">
          <label>Filter by Time Slot</label>
          <select
            className="qm-select"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
          >
            <option value="">All Slots</option>
            {slots.map((s) => (
              <option key={s} value={s}>
                Slot {s}
              </option>
            ))}
          </select>
        </div>

        <div className="qm-field qm-field--search">
          <label>Search Questions</label>
          <input
            type="text"
            className="qm-input"
            placeholder="Search by question text or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="qm-empty">Loading questions...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="qm-empty">No questions found for the selected filters.</div>
      ) : (
        <div className="qm-list">
          {filteredQuestions.map((q, idx) => (
            <div key={q.id || idx} className="qm-card">
              <div className="qm-card-head">
                <div className="qm-badges">
                  <span className="qm-badge qm-badge--id">#{q.id}</span>
                  <span className="qm-badge qm-badge--section">{q.section || "General"}</span>
                  <span
                    className={`qm-badge ${
                      q.slot_day != null && q.slot_number != null
                        ? "qm-badge--slot"
                        : "qm-badge--general"
                    }`}
                  >
                    {q.slot_day != null && q.slot_number != null
                      ? `Day ${q.slot_day} - Slot ${q.slot_number}`
                      : "General / All Slots"}
                  </span>
                </div>

                <div className="qm-card-actions">
                  <button className="qm-btn-sm qm-btn-sm--edit" onClick={() => handleOpenEditModal(q)}>
                    Edit
                  </button>
                  <button className="qm-btn-sm qm-btn-sm--delete" onClick={() => setDeletingId(q.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <h4 className="qm-question-text">{q.question_text}</h4>

              {(q.image_url || q.imageUrl) && (
                <div className="qm-card-image">
                  <img src={q.image_url || q.imageUrl} alt="Question visual" />
                </div>
              )}

              {/* Options */}
              <div className="qm-options">
                {getSafeOptionsArray(q.options || q.options_json).map((opt, oIdx) => {
                  const optVal = typeof opt === "object" ? opt.value : String(opt ?? "");
                  const isCorrect = oIdx === Number(q.correct_answer_index);
                  return (
                    <div key={oIdx} className={`qm-option ${isCorrect ? "qm-option--correct" : ""}`}>
                      <span className="qm-option-letter">{String.fromCharCode(65 + oIdx)}.</span>
                      <span>{optVal}</span>
                      {isCorrect && <span className="qm-option-check">✓</span>}
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
        <div className="qm-modal-overlay">
          <div className="qm-modal">
            <h3>{editingQuestion ? "Edit Question" : "Add New Question"}</h3>

            <form onSubmit={handleFormSubmit}>
              <div className="qm-form-group">
                <label className="qm-field-label">Question Text *</label>
                <textarea
                  required
                  rows={3}
                  className="qm-textarea"
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                />
              </div>

              <div className="qm-form-group">
                <label className="qm-field-label">Question Image URL (optional)</label>
                <input
                  type="url"
                  className="qm-input"
                  placeholder="https://example.com/image.png"
                  value={formData.image_url}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                />
                <div className="qm-image-url-meta">
                  <span className="qm-image-hint">Paste a direct link to an image hosted elsewhere.</span>
                  {formData.image_url && (
                    <button type="button" className="qm-image-remove" onClick={handleRemoveImage}>
                      Remove
                    </button>
                  )}
                </div>

                {formData.image_url && !imagePreviewFailed && (
                  <div className="qm-image-preview">
                    <img
                      src={formData.image_url}
                      alt="Question preview"
                      onError={() => setImagePreviewFailed(true)}
                      onLoad={() => setImagePreviewFailed(false)}
                    />
                  </div>
                )}
                {formData.image_url && imagePreviewFailed && (
                  <div className="qm-alert qm-alert--error qm-image-error">
                    Couldn't load a preview for this URL. Double-check the link — it will still be saved as entered.
                  </div>
                )}
                {imageError && <div className="qm-alert qm-alert--error qm-image-error">{imageError}</div>}
              </div>

              <div className="qm-form-row">
                <div>
                  <label className="qm-field-label">Section</label>
                  <input
                    type="text"
                    className="qm-input"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  />
                </div>

                <div>
                  <label className="qm-field-label">Slot Day</label>
                  <select
                    className="qm-select"
                    value={formData.slot_day}
                    onChange={(e) => setFormData({ ...formData, slot_day: e.target.value })}
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
                  <label className="qm-field-label">Slot Number</label>
                  <select
                    className="qm-select"
                    value={formData.slot_number}
                    onChange={(e) => setFormData({ ...formData, slot_number: e.target.value })}
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
              <div className="qm-form-group">
                <label className="qm-field-label">Options & Correct Answer *</label>
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="qm-option-row">
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={formData.correct_answer_index === idx}
                      onChange={() => setFormData({ ...formData, correct_answer_index: idx })}
                    />
                    <span className="qm-option-letter-input">{String.fromCharCode(65 + idx)}:</span>
                    <input
                      type="text"
                      required={idx < 2}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="qm-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                ))}
              </div>

              <div className="qm-modal-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  {editingQuestion ? "Save Changes" : "Create Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="confirm-overlay">
          <div className="confirm-dialog confirm-dialog--danger">
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Delete Question</div>
            <p className="confirm-message">
              Are you sure you want to delete this question? This action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn--cancel" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                className="confirm-btn confirm-btn--danger"
                onClick={() => handleDeleteConfirm(deletingId)}
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

class QuizErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("QuizQuestionsManager Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", backgroundColor: "#1e293b", color: "#fca5a5", borderRadius: "0.75rem", margin: "1.5rem", border: "1px solid #334155" }}>
          <h3 style={{ marginTop: 0 }}>Quiz Questions Manager encountered an error.</h3>
          <p style={{ color: "#cbd5e1" }}>{this.state.error?.message || "An unexpected rendering error occurred."}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "0.5rem 1rem", backgroundColor: "#6366f1", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600" }}
          >
            Reload Quiz Manager
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SafeQuizQuestionsManager(props) {
  return (
    <QuizErrorBoundary>
      <QuizQuestionsManager {...props} />
    </QuizErrorBoundary>
  );
}

export default SafeQuizQuestionsManager;
