const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const monthlyExpenditureCalc = `  // Monthly expenditure trends
  const monthlyExpenditure = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    logsList.forEach(log => {
      if (!log.date) return;
      const dateObj = new Date(log.date);
      const monthYear = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const logCost = log.spares ? log.spares.reduce((sum, s) => sum + (s.quantity * (s.priceAtTime || 0)), 0) : 0;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = 0;
      }
      monthlyData[monthYear] += logCost;
    });

    const sortedKeys = Object.keys(monthlyData).sort((a, b) => {
      // Parse "Jan 24" -> "Jan 2024"
      const parseDate = (my) => {
        const [m, y] = my.split(' ');
        return new Date(m + " 20" + y).getTime();
      };
      return parseDate(a) - parseDate(b);
    });

    return sortedKeys.map(key => ({
      name: key,
      expenditure: monthlyData[key]
    }));
  }, [logsList]);
`;

code = code.replace(
  '  // Grouped spares used stats',
  monthlyExpenditureCalc + '\n  // Grouped spares used stats'
);

fs.writeFileSync('src/App.tsx', code);
