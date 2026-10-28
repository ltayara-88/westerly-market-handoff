// Publishes the Westerly Market help-center drafts created by 37a-create-westerly-articles.apex.
// Only drafts whose URL name starts with "westerly-" are touched.
for (Knowledge__kav k : [
    SELECT KnowledgeArticleId, UrlName FROM Knowledge__kav
    WHERE PublishStatus = 'Draft' AND Language = 'en_US' AND UrlName LIKE 'westerly-%'
]) {
    KbManagement.PublishingService.publishArticle(k.KnowledgeArticleId, true);
    System.debug('Published ' + k.UrlName);
}
