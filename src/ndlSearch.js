/**
 * NDL Search (国立国会図書館サーチ) SRU API から書籍情報を取得する
 *
 * 和書の補完用。出版社情報やNDC分類を取得。
 * レスポンスはRDF/XML形式。
 */

/**
 * ISO 639-2 (3文字) → ISO 639-1 (2文字) 変換テーブル（主要言語のみ）
 */
var ISO639_2_TO_1 = {
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
    var doc = XmlService.parse(xmlText);
    var root = doc.getRootElement();

    // numberOfRecords を確認
    var ns_srw = XmlService.getNamespace('http://www.loc.gov/zing/srw/');
    var numRecords = root.getChild('numberOfRecords', ns_srw);
    if (!numRecords || numRecords.getText() === '0') return null;

    // recordData内のRDF/XMLからデータを抽出
    // XmlServiceではHTMLエンティティでエスケープされた中身を文字列として取得する
    var records = root.getChild('records', ns_srw);
    if (!records) return null;
    var record = records.getChild('record', ns_srw);
    if (!record) return null;
    var recordData = record.getChild('recordData', ns_srw);
    if (!recordData) return null;

    // recordDataの中身はエスケープされたXML文字列
    var rdfText = recordData.getText();
    if (!rdfText || rdfText.trim() === '') return null;

    // 内側のRDF XMLをパース
    var rdfDoc = XmlService.parse(rdfText);
    var rdfRoot = rdfDoc.getRootElement();

    var ns_dcterms = XmlService.getNamespace('dcterms', 'http://purl.org/dc/terms/');
    var ns_dc = XmlService.getNamespace('dc', 'http://purl.org/dc/elements/1.1/');
    var ns_foaf = XmlService.getNamespace('foaf', 'http://xmlns.com/foaf/0.1/');
    var ns_dcndl = XmlService.getNamespace('dcndl', 'http://ndl.go.jp/dcndl/terms/');
    var ns_rdf = XmlService.getNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');

    // BibResource 要素を探す
    var allChildren = rdfRoot.getChildren();
    var bibResource = null;
    for (var i = 0; i < allChildren.length; i++) {
      if (allChildren[i].getName() === 'BibResource' &&
          allChildren[i].getNamespace().getURI() === 'http://ndl.go.jp/dcndl/terms/') {
        // title属性を持つBibResourceを選ぶ
        if (allChildren[i].getChild('title', ns_dcterms)) {
          bibResource = allChildren[i];
          break;
        }
      }
    }
    if (!bibResource) return null;

    // タイトル
    var titleEl = bibResource.getChild('title', ns_dcterms);
    var title = titleEl ? titleEl.getText() : '';

    // 著者: dc:creator のテキストから役割を判定して著者のみ抽出
    // パターン例:
    //   "長島正治 著"  "Richard S.Sutton, Andrew G.Barto [著]"
    //   "刈屋武昭 [ほか著]"  "アンソニー・E.ボードマン [ほか]著"
    //   "三上貞芳, 皆川雅章 共訳"  "by Ramaprasad Bhar and Shigeyuki Hamori"
    var authors = [];
    var dcCreators = bibResource.getChildren('creator', ns_dc);
    for (var di = 0; di < dcCreators.length; di++) {
      var rawText = dcCreators[di].getText().trim();
      if (!rawText) continue;
      // 「訳」「監訳」を含み「著」を含まない → 翻訳者 → スキップ
      if (/訳/.test(rawText) && !/著/.test(rawText)) continue;
      // 役割テキスト・装飾を除去して人名のみ取り出す
      var cleaned = rawText
        .replace(/\s*[\[［]ほか[\]］]?\s*/g, '')     // [ほか] / [ほか を除去
        .replace(/\s*[\[［]?著[\]］]?\s*$/g, '')     // 末尾の 著 / [著] / ［著］
        .replace(/\s*編著?\s*$/g, '')                 // 末尾の 編 / 編著
        .replace(/\s*著?\s*;\s*.*$/g, '')              // 「著 ; 訳者名 訳」の後半除去
        .replace(/^by\s+/i, '')                        // 英語 "by " 接頭辞
        .trim();
      if (!cleaned) continue;
      // "X and Y" → カンマ区切りに統一してから分割
      cleaned = cleaned.replace(/\s+and\s+/gi, ', ');
      var names = cleaned.split(/[,、]\s*/);
      for (var ni = 0; ni < names.length; ni++) {
        var n = names[ni].trim();
        if (n) authors.push(n);
      }
    }
    // dc:creator に著者が見つからなければ foaf:name にフォールバック
    if (authors.length === 0) {
      var creatorEls = bibResource.getChildren('creator', ns_dcterms);
      for (var ci = 0; ci < creatorEls.length; ci++) {
        var agentEl = creatorEls[ci].getChild('Agent', ns_foaf);
        if (agentEl) {
          var nameEl = agentEl.getChild('name', ns_foaf);
          if (nameEl) authors.push(nameEl.getText());
        }
      }
    }

    // 出版社
    var publisher = '';
    var pubEl = bibResource.getChild('publisher', ns_dcterms);
    if (pubEl) {
      var pubAgent = pubEl.getChild('Agent', ns_foaf);
      if (pubAgent) {
        var pubName = pubAgent.getChild('name', ns_foaf);
        if (pubName) publisher = pubName.getText();
      }
    }

    // 出版日
    var publishedDate = '';
    var dateEl = bibResource.getChild('date', ns_dcterms);
    if (dateEl) publishedDate = dateEl.getText();

    // 言語 (ISO 639-2 → ISO 639-1 変換)
    var language = '';
    var langEl = bibResource.getChild('language', ns_dcterms);
    if (langEl) {
      var lang3 = langEl.getText().toLowerCase();
      language = ISO639_2_TO_1[lang3] || lang3;
    }

    // 件名: dcterms:subject > rdf:Description > rdf:value のみ取得
    // - dcterms:subject rdf:resource="..." (自己閉じ) → NDC9/NDLC分類URL → スキップ
    // - dc:subject rdf:datatype="...NDC8" → 分類番号 → スキップ
    // - dcterms:subject > rdf:Description > rdf:value → NDLSH件名 → 取得対象
    var categories = [];
    var subjectEls = bibResource.getChildren('subject', ns_dcterms);
    for (var si = 0; si < subjectEls.length; si++) {
      var subEl = subjectEls[si];
      // 子要素がない = rdf:resource 自己閉じ → スキップ
      if (subEl.getChildren().length === 0) continue;

      var descEl = subEl.getChild('Description', ns_rdf);
      if (descEl) {
        var valEl = descEl.getChild('value', ns_rdf);
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
    Logger.log('NDL parse error: ' + e.message);
    return null;
  }
}

/**
 * NDL Search SRU APIから書籍情報を取得する（GAS用）
 * @param {string} isbn13
 * @returns {object|null} BookInfo or null
 */
function fetchFromNdlSearch(isbn13) {
  var url = 'https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve'
    + '&recordSchema=dcndl'
    + '&maximumRecords=1'
    + '&onlyBib=true'
    + '&query=isbn=' + isbn13;

  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    if (code !== 200) {
      Logger.log('NDL Search API error: HTTP ' + code);
      return null;
    }
    return parseNdlResponse(isbn13, response.getContentText());
  } catch (e) {
    Logger.log('NDL Search API fetch error: ' + e.message);
    return null;
  }
}
