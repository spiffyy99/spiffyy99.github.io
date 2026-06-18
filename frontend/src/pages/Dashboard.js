import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Trophy, Target } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/game/stats`);
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <p className="text-[#9CA3AF]">Loading stats...</p>
      </div>
    );
  }

  if (!stats || stats.total_games === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <button
            data-testid="back-button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </button>

          <div className="text-center py-20">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1A1A1A] mb-4">
              No Games Played Yet
            </h2>
            <p className="text-[#9CA3AF] mb-8">
              Start playing to see your progress and statistics here!
            </p>
            <button
              data-testid="start-playing-button"
              onClick={() => navigate('/')}
              className="rounded-none bg-[#002FA7] text-white hover:bg-[#002FA7]/90 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold uppercase tracking-wider text-sm px-6 py-3"
            >
              Start Playing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        {/* Header */}
        <button
          data-testid="back-button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#002FA7] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>

        <div className="mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1A1A1A] mb-2">
            Your Progress
          </h2>
          <p className="text-[#9CA3AF]">Track your chord mastery across all keys</p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border border-[#E5E7EB] rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#002FA7]/10 rounded-sm">
                <TrendingUp className="w-5 h-5 text-[#002FA7]" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                Total Games
              </p>
            </div>
            <p className="text-4xl font-bold text-[#1A1A1A]" data-testid="total-games">
              {stats.total_games}
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#059669]/10 rounded-sm">
                <Target className="w-5 h-5 text-[#059669]" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                Overall Accuracy
              </p>
            </div>
            <p className="text-4xl font-bold text-[#059669]" data-testid="overall-accuracy">
              {stats.overall_accuracy}%
            </p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-sm p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#FF3B30]/10 rounded-sm">
                <Trophy className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                Favorite Key
              </p>
            </div>
            <p className="text-4xl font-bold text-[#1A1A1A]" data-testid="favorite-key">
              {stats.favorite_key || 'N/A'}
            </p>
          </div>
        </div>

        {/* Per-Key Statistics */}
        <div className="bg-white border border-[#E5E7EB] rounded-sm p-6 shadow-sm">
          <h3 className="text-xl font-medium tracking-tight text-[#1A1A1A] mb-6">
            Performance by Key
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full" data-testid="key-stats-table">
              <thead>
                <tr className="border-b-2 border-[#E5E7EB]">
                  <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Key
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Games Played
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Avg Accuracy
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Recent Accuracy
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Best Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.key_stats.map((keyStat, index) => (
                  <tr
                    key={keyStat.key}
                    data-testid={`key-row-${keyStat.key}`}
                    className="border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="font-bold text-[#1A1A1A]">{keyStat.key}</span>
                    </td>
                    <td className="text-center py-4 px-4 text-[#1A1A1A]">
                      {keyStat.total_games}
                    </td>
                    <td className="text-center py-4 px-4">
                      <span className={`font-bold ${
                        keyStat.average_accuracy >= 90 ? 'text-[#059669]' :
                        keyStat.average_accuracy >= 70 ? 'text-[#002FA7]' :
                        'text-[#FF3B30]'
                      }`}>
                        {keyStat.average_accuracy}%
                      </span>
                    </td>
                    <td className="text-center py-4 px-4">
                      <span className={`font-bold ${
                        keyStat.recent_accuracy >= 90 ? 'text-[#059669]' :
                        keyStat.recent_accuracy >= 70 ? 'text-[#002FA7]' :
                        'text-[#FF3B30]'
                      }`}>
                        {keyStat.recent_accuracy}%
                      </span>
                    </td>
                    <td className="text-center py-4 px-4">
                      <span className="font-bold text-[#1A1A1A]">{keyStat.best_score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
