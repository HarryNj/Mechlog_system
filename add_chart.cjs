const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const chartCode = `
              {/* Expenditure Trends Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Monthly Expenditure Trends</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Tracking maintenance costs over time</p>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyExpenditure} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickFormatter={(value) => \`K\${value}\`}
                        width={60}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [\`K\${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}\`, 'Expenditure']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="expenditure" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
`;

code = code.replace(
  '{/* Quick Admin Protocol (Shortcut Matrix) */}',
  chartCode + '\n              {/* Quick Admin Protocol (Shortcut Matrix) */}'
);

fs.writeFileSync('src/App.tsx', code);
