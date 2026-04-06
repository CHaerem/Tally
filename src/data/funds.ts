export interface StockSuggestion {
  ticker: string;
  name: string;
  currentPrice: number | null;
  type: 'STOCK' | 'FUND';
}

// Popular Norwegian mutual funds with Yahoo Finance Morningstar IDs
export const NORWEGIAN_FUNDS: StockSuggestion[] = [
  // DNB
  { ticker: '0P0000PS3U.IR', name: 'DNB Norge Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NKJ.IR', name: 'DNB Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNB.IR', name: 'DNB Norge A', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNG.IR', name: 'DNB Norge Selektiv', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001Q8AD.IR', name: 'DNB Global Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MUA.IR', name: 'DNB Global Emerging Markets', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MVB.IR', name: 'DNB Teknologi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BJ8T.IR', name: 'DNB Miljøinvest', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001CTL0.IR', name: 'DNB Norden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFN5.IR', name: 'DNB Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BJ8N.IR', name: 'DNB Finans', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O4C.IR', name: 'DNB Barnefond', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNK.IR', name: 'DNB Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EFNN.IR', name: 'DNB Obligasjon 20', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017AUH.IR', name: 'DNB Global Treasury', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001F1IM.IR', name: 'DNB AM Norske Aksjer', currentPrice: null, type: 'FUND' },
  // Storebrand
  { ticker: '0P0001HAP0.IR', name: 'Storebrand Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00012AVM.IR', name: 'Storebrand Indeks Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001ACQT.IR', name: 'Storebrand Norge Horisont', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000A82Y.IR', name: 'Storebrand Global Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BL9W.IR', name: 'Storebrand Global Optimised', currentPrice: null, type: 'FUND' },
  { ticker: '0P00007ZI2.IR', name: 'Storebrand Global Multifactor', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001M3YC.IR', name: 'Storebrand Indeks - Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O5V.IR', name: 'Storebrand Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001KO95.IR', name: 'Storebrand Vekst', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O4T.IR', name: 'Storebrand Aksje Innland', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000TNI3.IR', name: 'Storebrand Forsiktig', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001HAOZ.IR', name: 'Storebrand Likviditet', currentPrice: null, type: 'FUND' },
  // KLP
  { ticker: '0P00001BVT.IR', name: 'KLP AksjeNorge Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPC5.IR', name: 'KLP AksjeVerden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00018V9L.IR', name: 'KLP AksjeGlobal Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBV.IR', name: 'KLP AksjeNorden Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPC2.IR', name: 'KLP AksjeUSA Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBA.IR', name: 'KLP AksjeEuropa Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBE.IR', name: 'KLP AksjeFremvoksende Markeder Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBN.IR', name: 'KLP AksjeGlobal Mer Samfunnsansvar', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001OPBH.IR', name: 'KLP AksjeGlobal Flerfaktor', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001BWAQ.IR', name: 'KLP AksjeGlobal Small Cap Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00006D9Q.IR', name: 'KLP AksjeAsia Indeks', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017YPW.IR', name: 'KLP AksjeAsia Indeks Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MY9.IR', name: 'KLP Obligasjon 5 år', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IFZZ.IR', name: 'KLP Obligasjon 1 år Mer Samfunnsansvar', currentPrice: null, type: 'FUND' },
  { ticker: '0P00002C94.IR', name: 'KLP Obligasjon Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MYB.IR', name: 'KLP Likviditet', currentPrice: null, type: 'FUND' },
  { ticker: '0P00019ADK.IR', name: 'KLP Framtid', currentPrice: null, type: 'FUND' },
  // Nordnet
  { ticker: '0P000134K7.IR', name: 'Nordnet Indeksfond Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001K6NJ.IR', name: 'Nordnet Indeksfond Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001RMV1.IR', name: 'Nordnet Global Indeks 125', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001M5YQ.IR', name: 'Nordnet Indeksfond Teknologi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001K6NB.IR', name: 'Nordnet Indeksfond Emerging Markets', currentPrice: null, type: 'FUND' },
  // ODIN
  { ticker: '0P000161CO.IR', name: 'ODIN Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVG.IR', name: 'ODIN Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVE.IR', name: 'ODIN Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O88.IR', name: 'ODIN Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SVP.IR', name: 'ODIN Eiendom', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001J3OK.IR', name: 'ODIN Small Cap', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OC2.IR', name: 'ODIN Norsk Obligasjon', currentPrice: null, type: 'FUND' },
  // Nordea
  { ticker: '0P0001SQM9.IR', name: 'Nordea Norge Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001SQMA.IR', name: 'Nordea Norge Pluss', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001TPW6.IR', name: 'Nordea Stabile Aksjer Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001TPW7.IR', name: 'Nordea Avkastning', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001CKST.IR', name: 'Nordea Global Enhanced', currentPrice: null, type: 'FUND' },
  // Skagen
  { ticker: '0P00013OX2.IR', name: 'Skagen Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00013OX3.IR', name: 'Skagen Kon-Tiki', currentPrice: null, type: 'FUND' },
  { ticker: '0P00013OX6.IR', name: 'Skagen Vekst', currentPrice: null, type: 'FUND' },
  { ticker: '0P00015YSS.IR', name: 'Skagen Focus', currentPrice: null, type: 'FUND' },
  // Holberg
  { ticker: '0P00000OCZ.IR', name: 'Holberg Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OCX.IR', name: 'Holberg Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IZAY.IR', name: 'Holberg Global Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NXT.IR', name: 'Holberg Obligasjon Norden', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OCR.IR', name: 'Holberg Likviditet', currentPrice: null, type: 'FUND' },
  // Delphi
  { ticker: '0P00000HCS.IR', name: 'Delphi Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00005UKR.IR', name: 'Delphi Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001A1QS.IR', name: 'Delphi Global Valutasikret', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HCV.IR', name: 'Delphi Kombinasjon', currentPrice: null, type: 'FUND' },
  // Alfred Berg
  { ticker: '0P00000MT3.IR', name: 'Alfred Berg Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MVR.IR', name: 'Alfred Berg Gambak', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000O9F.IR', name: 'Alfred Berg Gambak Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001EUC3.IR', name: 'Alfred Berg Gambak Nordic', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MSP.IR', name: 'Alfred Berg Aktiv', currentPrice: null, type: 'FUND' },
  { ticker: '0P000015PZ.IR', name: 'Alfred Berg Indeks', currentPrice: null, type: 'FUND' },
  // Arctic
  { ticker: '0P0000S1O6.IR', name: 'Arctic Norwegian Equities', currentPrice: null, type: 'FUND' },
  { ticker: '0P000195U2.IR', name: 'Arctic Norwegian Value Creation', currentPrice: null, type: 'FUND' },
  { ticker: '0P00015EZF.IR', name: 'Arctic Return', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000RUOV.IR', name: 'Arctic Nordic Corporate Bond', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000RUOU.IR', name: 'Arctic Nordic Investment Grade', currentPrice: null, type: 'FUND' },
  // Handelsbanken
  { ticker: '0P0001CW9F.IR', name: 'Handelsbanken Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001A1QL.IR', name: 'Handelsbanken Norge A1', currentPrice: null, type: 'FUND' },
  // Pareto
  { ticker: '0P00000NY6.IR', name: 'Pareto Aksje Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00001BTH.IR', name: 'Pareto Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000OAI.IR', name: 'Pareto Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000YT99.IR', name: 'Pareto Nordic Corporate Bond', currentPrice: null, type: 'FUND' },
  // Landkreditt
  { ticker: '0P00001E5D.IR', name: 'Landkreditt Aksje Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000Y66P.IR', name: 'Landkreditt Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001FTOL.IR', name: 'Landkreditt Norden Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P00001E5H.IR', name: 'Landkreditt Høyrente', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000X9XC.IR', name: 'Landkreditt Extra', currentPrice: null, type: 'FUND' },
  // PLUSS (Fondsforvaltning)
  { ticker: '0P00000MXR.IR', name: 'PLUSS Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MXH.IR', name: 'PLUSS Markedsverdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MX1.IR', name: 'PLUSS Utland Aksje', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001T9DH.IR', name: 'PLUSS Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000MXL.IR', name: 'PLUSS Likviditet', currentPrice: null, type: 'FUND' },
  // C WorldWide
  { ticker: '0P00000O6S.IR', name: 'C WorldWide Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000SV3.IR', name: 'C WorldWide Stabile Aksjer', currentPrice: null, type: 'FUND' },
  // Norne
  { ticker: '0P0001LR0Y.IR', name: 'Norne Aksje Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001J97B.IR', name: 'Norne Aksje Classic', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001KDPB.IR', name: 'Norne Rente', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LR14.IR', name: 'Norne Kombi 80', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LRWP.IR', name: 'Norne Kombi 20', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LRWQ.IR', name: 'Norne Kombi 50', currentPrice: null, type: 'FUND' },
  // Fondsfinans
  { ticker: '0P00000L92.IR', name: 'Fondsfinans Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HII.IR', name: 'Fondsfinans Aktiv 60/40', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000HIN.IR', name: 'Fondsfinans Fornybar Energi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001IEW6.IR', name: 'Fondsfinans Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P00016NF4.IR', name: 'Fondsfinans Norden Utbytte', currentPrice: null, type: 'FUND' },
  { ticker: '0P000131AW.IR', name: 'Fondsfinans High Yield', currentPrice: null, type: 'FUND' },
  { ticker: '0P00017UZ2.IR', name: 'Fondsfinans Obligasjon', currentPrice: null, type: 'FUND' },
  // Eika
  { ticker: '0P00000HD4.IR', name: 'Eika Norge', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000ODT.IR', name: 'Eika Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P00000NYF.IR', name: 'Eika Balansert', currentPrice: null, type: 'FUND' },
  // SpareBank 1
  { ticker: '0P0001PMGR.IR', name: 'SpareBank 1 Indeks Global', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001MLUK.IR', name: 'SpareBank 1 Norge Verdi', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001LLD4.IR', name: 'SpareBank 1 Aksjer Svanemerket', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000X18D.IR', name: 'SpareBank 1 Indeks Moderat 50', currentPrice: null, type: 'FUND' },
  { ticker: '0P0000Z0FJ.IR', name: 'SpareBank 1 Indeks Forsiktig 25', currentPrice: null, type: 'FUND' },
  // Danske Invest
  { ticker: '0P0000ZSIB.IR', name: 'Danske Invest Norsk Kort Obligasjon', currentPrice: null, type: 'FUND' },
  { ticker: '0P00016RIB.IR', name: 'Danske Invest Norske Aksjer Inst', currentPrice: null, type: 'FUND' },
  // Carnegie
  { ticker: '0P0001RTTV.IR', name: 'Carnegie Global Resilient Small Cap', currentPrice: null, type: 'FUND' },
  // FIRST
  { ticker: '0P0001IBOU.IR', name: 'FIRST Veritas', currentPrice: null, type: 'FUND' },
  // Sbanken
  { ticker: '0P00017BQO.IR', name: 'Sbanken Framgang Sammen', currentPrice: null, type: 'FUND' },
  // Gjensidige
  { ticker: '0P0000J7K8.IR', name: 'Gjensidige Likviditet', currentPrice: null, type: 'FUND' },
  // Heimdal
  { ticker: '0P0001Q692.IR', name: 'Heimdal Utbytte D', currentPrice: null, type: 'FUND' },
  { ticker: '0P0001Q690.IR', name: 'Heimdal Utbytte B', currentPrice: null, type: 'FUND' },
];
