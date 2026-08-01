const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add import
if (!code.includes("react-phone-number-input")) {
  code = code.replace("import { motion } from 'motion/react';", "import { motion } from 'motion/react';\nimport 'react-phone-number-input/style.css';\nimport PhoneInput from 'react-phone-number-input';");
}

// 2. Remove COUNTRIES array
code = code.replace(/const COUNTRIES = \[\s*\{ name: "Zambia"[\s\S]*?\];/g, "");

// 3. Remove selectedCountryCode and localPhoneInput state
code = code.replace(/const \[selectedCountryCode, setSelectedCountryCode\] = useState\("\+260"\);\s*/, "");
code = code.replace(/const \[localPhoneInput, setLocalPhoneInput\] = useState\(""\);\s*/, "");

// 4. Update finalPhone logic
code = code.replace(/const finalPhone = selectedCountryCode \+ localPhoneInput\.trim\(\)\.replace\(\/\\D\/g, ""\);/, "const finalPhone = authPhone;");
code = code.replace(/if \(!authEmail \|\| !authPassword \|\| !authName \|\| !localPhoneInput\) \{/, "if (!authEmail || !authPassword || !authName || !authPhone) {");

// 5. Replace UI component
const uiOld = `<div className="flex gap-2">
                        <div className="relative w-1/3">
                          <select
                            value={selectedCountryCode}
                            onChange={(e) => setSelectedCountryCode(e.target.value)}
                            className="block w-full px-3 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
                            ▼
                          </div>
                        </div>
                        
                        <div className="relative flex-1 group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Phone className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                          </div>
                          <input
                            type="tel"
                            required
                            placeholder="Phone Number"
                            value={localPhoneInput}
                            onChange={(e) => setLocalPhoneInput(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all tracking-widest"
                          />
                        </div>
                      </div>`;

const uiNew = `<div className="relative group">
                        <PhoneInput
                          international
                          defaultCountry="ZM"
                          value={authPhone}
                          onChange={(v) => setAuthPhone(v as string || "")}
                          className="block w-full px-4 py-3.5 bg-slate-50/60 border border-slate-200 focus-within:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all tracking-widest [&>input]:bg-transparent [&>input]:border-none [&>input]:outline-none [&>input]:w-full"
                          style={{ '--PhoneInputCountryFlag-height': '20px', '--PhoneInputCountrySelectArrow-color': '#94a3b8' } as any}
                        />
                      </div>`;

code = code.replace(uiOld, uiNew);

fs.writeFileSync('src/App.tsx', code);
