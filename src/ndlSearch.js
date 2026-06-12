/**
 * NDL Search (国立国会図書館サーチ) SRU API から書籍情報を取得する
 *
 * 和書の補完用。出版社情報やNDC分類を取得。
 * レスポンスはRDF/XML形式。
 */

/**
 * ISO 639-2 (3文字) → ISO 639-1 (2文字) 変換テーブル（主要言語のみ）
 */
const ISO639_2_TO_1 = {
  'jpn': 'ja', 'eng': 'en', 'zho': 'zh', 'chi': 'zh',
  'kor': 'ko', 'fra': 'fr', 'fre': 'fr', 'deu': 'de', 'ger': 'de',
  'spa': 'es', 'por': 'pt', 'ita': 'it', 'rus': 'ru', 'ara': 'ar'
};

/**
 * NDL SRU XMLレスポンスから BookInfo を抽出する
 * @param {string} isbn13
 * @param {string} xmlText - NDL SRU APIの生XMLレスポンス
 * @returns {object|null} BookInfo or null
 */
function parseNdlResponse(isbn13, xmlText) {
  if (!xmlText || xmlText.trim() === '') return null;

  try {
    const doc = XmlService.parse(xmlText);
    const root = doc.getRootElement();

    // numberOfRecords を確認
    const ns_srw = XmlService.getNamespace('http://www.loc.gov/zing/srw/');
    const numRecords = root.getChild('numberOfRecords', ns_srw);
    if (!numRecords || numRecords.getText() === '0') return null;

    // recordData内のRDF/XMLからデータを抽出
    // XmlServiceではHTMLエンティティでエスケープされた中身を文字列として取得する
    const records = root.getChild('records', ns_srw);
    if (!records) return null;

    // 複数レコードから「図書(book)」を優先して選ぶ
    // 同一ISBNで記事・論文と図書の両方がヒットする場合がある
    const allRecords = records.getChildren('record', ns_srw);
    let rdfRoot = null;
    let rdfRootFallback = null;
    for (const record of allRecords) {
      const recordData = record.getChild('recordData', ns_srw);
      if (!recordData) continue;
      const rdfText = recordData.getText();
      if (!rdfText || rdfText.trim() === '') continue;
      const candidateRoot = XmlService.parse(rdfText).getRootElement();
      // type: book かどうかを description から判定
      if (rdfText.indexOf('type : book') !== -1) {
        rdfRoot = candidateRoot;
        break;
      }
      if (!rdfRootFallback) {
        rdfRootFallback = candidateRoot;
      }
    }
    if (!rdfRoot) rdfRoot = rdfRootFallback;
    if (!rdfRoot) return null;

    const ns_dcterms = XmlService.getNamespace('dcterms', 'http://purl.org/dc/terms/');
    const ns_dc = XmlService.getNamespace('dc', 'http://purl.org/dc/elements/1.1/');
    const ns_foaf = XmlService.getNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    const ns_rdf = XmlService.getNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

    // BibResource 要素を探す
    let bibResource = null;
    for (const child of rdfRoot.getChildren()) {
      if (child.getName() === 'BibResource' &&
          child.getNamespace().getURI() === 'http://ndl.go.jp/dcndl/terms/') {
        // title属性を持つBibResourceを選ぶ
        if (child.getChild('title', ns_dcterms)) {
          bibResource = child;
          break;
        }
      }
    }
    if (!bibResource) return null;

    // タイトル
    const titleEl = bibResource.getChild('title', ns_dcterms);
    const title = titleEl ? titleEl.getText() : '';

    // 著者: dc:creator のテキストから役割を判定して著者のみ抽出
    // パターン例:
    //   "長島正治 著"  "Richard S.Sutton, Andrew G.Barto [著]"
    //   "刈屋武昭 [ほか著]"  "アンソニー・E.ボードマン [ほか]著"
    //   "三上貞芳, 皆川雅章 共訳"  "by Ramaprasad Bhar and Shigeyuki Hamori"
    const authors = [];
    for (const creator of bibResource.getChildren('creator', ns_dc)) {
      const rawText = creator.getText().trim();
      if (!rawText) continue;
      // 「訳」「監訳」を含み「著」を含まない → 翻訳者 → スキップ
      if (/訳/.test(rawText) && !/著/.test(rawText)) continue;
      // 役割テキスト・装飾を除去して人名のみ取り出す
      let cleaned = rawText
        .replace(/\s*[\[［]ほか[\]］]?\s*/g, '')     // [ほか] / [ほか を除去
        .replace(/\s*[\[［]?著[\]］]?\s*$/g, '')     // 末尾の 著 / [著] / ［著］
        .replace(/\s*編著?\s*$/g, '')                 // 末尾の 編 / 編著
        .replace(/\s*著?\s*;\s*.*$/g, '')              // 「著 ; 訳者名 訳」の後半除去
        .replace(/^by\s+/i, '')                        // 英語 "by " 接頭辞
        .trim();
      if (!cleaned) continue;
      // "X and Y" → カンマ区切りに統一してから分割
      cleaned = cleaned.replace(/\s+and\s+/gi, ', ');
      for (const name of cleaned.split(/[,、]\s*/)) {
        const n = name.trim();
        if (n) authors.push(n);
      }
    }
    // dc:creator に著者が見つからなければ foaf:name にフォールバック
    if (authors.length === 0) {
      for (const creatorEl of bibResource.getChildren('creator', ns_dcterms)) {
        const agentEl = creatorEl.getChild('Agent', ns_foaf);
        if (agentEl) {
          const nameEl = agentEl.getChild('name', ns_foaf);
          if (nameEl) authors.push(nameEl.getText());
        }
      }
    }

    // 出版社
    let publisher = '';
    const pubEl = bibResource.getChild('publisher', ns_dcterms);
    if (pubEl) {
      const pubAgent = pubEl.getChild('Agent', ns_foaf);
      if (pubAgent) {
        const pubName = pubAgent.getChild('name', ns_foaf);
        if (pubName) publisher = pubName.getText();
      }
    }

    // 出版日
    const dateEl = bibResource.getChild('date', ns_dcterms);
    const publishedDate = dateEl ? dateEl.getText() : '';

    // 言語 (ISO 639-2 → ISO 639-1 変換)
    let language = '';
    const langEl = bibResource.getChild('language', ns_dcterms);
    if (langEl) {
      const lang3 = langEl.getText().toLowerCase();
      language = ISO639_2_TO_1[lang3] || lang3;
    }

    // 件名: dcterms:subject > rdf:Description > rdf:value のみ取得
    // - dcterms:subject rdf:resource="..." (自己閉じ) → NDC9/NDLC分類URL → スキップ
    // - dc:subject rdf:datatype="...NDC8" → 分類番号 → スキップ
    // - dcterms:subject > rdf:Description > rdf:value → NDLSH件名 → 取得対象
    const categories = [];
    for (const subEl of bibResource.getChildren('subject', ns_dcterms)) {
      // 子要素がない = rdf:resource 自己閉じ → スキップ
      if (subEl.getChildren().length === 0) continue;

      const descEl = subEl.getChild('Description', ns_rdf);
      if (descEl) {
        const valEl = descEl.getChild('value', ns_rdf);
        if (valEl && valEl.getText().trim()) {
          categories.push(valEl.getText().trim());
        }
      }
    }

    return {
      isbn: isbn13,
      title: title,
      authors: authors,
      publisher: publisher,
      publishedDate: publishedDate,
      language: language,
      categories: categories,
      thumbnail: '',
      source: 'ndlSearch'
    };
  } catch (e) {
    Logger.log(`NDL parse error: ${e.message}`);
    return null;
  }
}

/**
 * NDL Search SRU APIから書籍情報を取得する（GAS用）
 * @param {string} isbn13
 * @returns {object|null} BookInfo or null
 */
function fetchFromNdlSearch(isbn13) {
  const url = 'https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve'
    + '&recordSchema=dcndl'
    + '&maximumRecords=5'
    + '&onlyBib=true'
    + `&query=isbn=${isbn13}`;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();
    if (code !== 200) {
      Logger.log(`NDL Search API error: HTTP ${code}`);
      return null;
    }
    return parseNdlResponse(isbn13, response.getContentText());
  } catch (e) {
    Logger.log(`NDL Search API fetch error: ${e.message}`);
    return null;
  }
}
