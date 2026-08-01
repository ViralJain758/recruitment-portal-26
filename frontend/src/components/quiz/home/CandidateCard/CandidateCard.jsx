import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Checkbox } from '../../common/Checkbox';
import { Button } from '../../common/Button';
import { User, Hash, School, ArrowRight } from 'lucide-react';

export const CandidateCard = () => {
  const { setCandidate } = useExam();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', enrollmentNumber: '', college: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const handleStart = (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.enrollmentNumber.trim() || !form.college.trim()) {
      setError('Please fill in all details.');
      return;
    }
    if (!confirmed) {
      setError('Please check the verification confirmation.');
      return;
    }
    setError('');
    setCandidate(form);
    navigate('/instructions');
  };

  return (
    <Card className="border-[#E5E7EB] bg-white flex flex-col justify-between">
      <form onSubmit={handleStart} className="space-y-4 flex-grow">
        <h3 className="text-lg font-bold text-[#111827] mb-2 border-b border-[#E5E7EB] pb-3">Candidate Verification</h3>
        <Input label="Full Name" icon={User} placeholder="Enter your full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        <Input label="Enrollment Number" icon={Hash} placeholder="e.g. 102203123" value={form.enrollmentNumber} onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })} required />
        <Input label="College" icon={School} placeholder="Thapar Institute of Engineering & Technology" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} required />
        <div className="pt-2">
          <Checkbox id="confirm-details" label="I confirm that the above information is correct." checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        </div>
        {error && <p className="text-xs font-semibold text-[#dc2626] bg-[#EF4444]/5 border border-[#EF4444]/15 p-2.5 rounded-lg">{error}</p>}
      </form>
      <div className="mt-6 pt-4 border-t border-[#E5E7EB]">
        <Button onClick={handleStart} className="w-full py-3">Continue to Instructions <ArrowRight className="w-4 h-4" /></Button>
      </div>
    </Card>
  );
};