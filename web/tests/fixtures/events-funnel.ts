// Test-only entry, never imported by the application or course registry.
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import '../../src/styles/widgets.css';
import '../../src/styles/explainer.css';
import { funnelModel, funnelCaption } from '../../src/blocks/events/funnel';
import { initLang, t } from '../../src/core/i18n';
import { fromModel } from '../../src/engine/explainer/render';
initLang();
document.querySelector('h1')!.textContent = t(funnelModel.title);
document.querySelector('#summary')!.textContent = t(funnelModel.summary!);
document.querySelector('#caption')!.textContent = t(funnelCaption);
const mounted = fromModel(funnelModel).mount(document.querySelector('#scheme')!, {
  level: 'experienced', onComplete() {}, record() {}, openDoc() {},
});
window.addEventListener('pagehide', () => mounted.dispose(), { once: true });
