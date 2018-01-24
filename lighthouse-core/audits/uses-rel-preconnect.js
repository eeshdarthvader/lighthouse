/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const Audit = require('./audit');
const Util = require('../report/v2/renderer/util');
const UnusedBytes = require('./byte-efficiency/byte-efficiency-audit');
const URL = require('../lib/url-shim');
const THRESHOLD_IN_MS = 100;

const learnMoreUrl =
  'https://developers.google.com/web/fundamentals/performance/resource-prioritization#preconnect';

class UsesRelPreconnectAudit extends Audit {
  /**
   * @return {!AuditMeta}
   */
  static get meta() {
    return {
      category: 'Performance',
      name: 'uses-rel-preconnect',
      description: 'Avoid multiple, costly round trips to any origin',
      helpText: 'Consider using<link rel=preconnect> to set up early connections before ' +
        'an HTTP request is actually sent to the server. This will reduce multiple, ' +
        `costly round trips to any origin. [Learn more](${learnMoreUrl}).`,
      requiredArtifacts: ['devtoolsLogs'],
      scoringMode: Audit.SCORING_MODES.NUMERIC,
    };
  }

  /**
   * @param {!Artifacts} artifacts
   * @return {!AuditResult}
   */
  static audit(artifacts) {
    const devtoolsLogs = artifacts.devtoolsLogs[UsesRelPreconnectAudit.DEFAULT_PASS];

    return Promise.all([
      artifacts.requestNetworkRecords(devtoolsLogs),
      artifacts.requestMainResource(devtoolsLogs),
    ]).then(([networkRecords, mainResource]) => {
      const mainResourceOrigin = new URL(mainResource.url).origin;
      const results = new Set(networkRecords.filter(record => {
        const requestDelay = record._startTime - mainResource._endTime;
        const recordOrigin = new URL(record.url).origin;

        return recordOrigin &&
          requestDelay > 0 && requestDelay < 10000 &&
          recordOrigin !== mainResourceOrigin;
      }).map(record => {
        return {
          url: new URL(record.url).origin,
          wastedMs: record.timing(),
        };
      }));

      const headings = [
        {key: 'url', itemType: 'url', text: 'URL'},
        {key: 'wastedMs', itemType: 'text', text: 'Potential Savings'},
      ];
      const details = Audit.makeTableDetails(headings, results);

      return {
        score: UnusedBytes.scoreForWastedMs(maxWasted),
        rawValue: maxWasted,
        displayValue: Util.formatMilliseconds(maxWasted),
        extendedInfo: {
          value: results,
        },
        details,
      };
    });
  }
}

module.exports = UsesRelPreconnectAudit;
