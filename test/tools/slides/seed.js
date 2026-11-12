// The made-up ward for the training video (approved fake names). Last week's huddle is waiting to be reported on.
const card = o => Object.assign({ name: '', sac: false, bap: '', temple: false, committed: false, ordinance: '', need: '', hneed: '', action: '', assigned: '', when: '', touched: '2026-11-14' }, o);
const rr = o => Object.assign({ prefilled: true, source: '', group: '', pname: '', person: '', action: '', assigned: '', when: '', happened: '', notes: '', hneed: '' }, o);
module.exports = {
  ward: 'Sample Ward', date: '2026-11-15', conducting: 'wml', attendees: [], rolledFrom: '2026-11-08',
  rr: [
    rr({ group: 'nm', source: 'New members', pname: 'Daniel Rivera', bap: '2026-10-30', ordinance: 'Baptisms for the dead', need: 'A ride to the temple', action: 'Invite him on the ward temple trip', assigned: 'Bro. Patel', when: 'Sat' }),
    rr({ group: 'rm', source: 'Returning members', pname: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church', action: 'Sit with her family at sacrament meeting', assigned: 'Sister Diaz', when: 'Sun' }),
    rr({ group: 'bt', source: 'Those being taught', pname: 'Marcus Hill', bap: '2026-11-28', committed: true, need: 'Get to know ward members', action: 'Invite him to the ward dinner', assigned: 'Elders quorum', when: 'Fri' })
  ],
  cp: {
    nm: [card({ name: 'Daniel Rivera', bap: '2026-10-30', ordinance: 'Baptisms for the dead', need: 'A ride to the temple' }), card({ name: 'Emma Walsh', bap: '2026-10-05', temple: true, ordinance: 'Aaronic Priesthood' })],
    rm: [card({ name: 'Olivia Chen', ordinance: 'Endowment', need: 'A friend at church' })],
    bt: [card({ name: 'Marcus Hill', bap: '2026-11-28', committed: true, need: 'Get to know ward members' }), card({ name: 'Samuel Ortiz', need: '' })]
  },
  cpNone: {}, tn: [card({ name: 'Grace Thompson', ordinance: 'Sealing', need: 'Help preparing family names' }), card({ name: 'Marcus Bell', ordinance: '', need: '' }), card({ touched: '' })],
  find: { plan: '', items: [{ task: '', when: '' }] }, referrals: [], stepsDone: {}, verified: { before: false, after: false }
};
